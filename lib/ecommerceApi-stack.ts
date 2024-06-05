import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"

interface ECommerceApiStackProps extends cdk.StackProps{
    productsFetchHandler: lambdaNodeJS.NodejsFunction;
    productsAdminHandler: lambdaNodeJS.NodejsFunction;
    ordersHandler: lambdaNodeJS.NodejsFunction;
    orderEventsFetchHandler: lambdaNodeJS.NodejsFunction;
}

export class ECommerceApiStack extends cdk.Stack {
    private productsAuthorizer: apigateway.CognitoUserPoolsAuthorizer
    private customerPool: cognito.UserPool
    private adminPool: cognito.UserPool

    constructor(scope: Construct, id: string, props: ECommerceApiStackProps){
        super(scope, id, props)

        const logGroup = new cwlogs.LogGroup(this, "ECommerceApiLogs")
        const api = new apigateway.RestApi(this, "ECommerceApi", {
            restApiName: "ECommerceApi",
            cloudWatchRole: true,
            deployOptions:{
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    httpMethod: true, ip: true, protocol: true, requestTime: true,
                    resourcePath: true, responseLength: true, status: true, caller: true, user: true
                })
            }
        })

        this.createCognitoAuth()
        this.createProductsService(props, api)
        this.createOrdersService(props, api)
    }

    private createCognitoAuth(){
        //Cognito customer UserPool
        this.customerPool = new cognito.UserPool(this, "CustomerPool", {
            userPoolName: "CustomerPool",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            selfSignUpEnabled: true,
             autoVerify: {
                email: true,
                phone: false
             },
             userVerification: {
                emailSubject: "Verify your email for the ECommerce service!",
                emailBody: "Thanks for signing up to ECommerce service! Your verification code is {####}",
                emailStyle: cognito.VerificationEmailStyle.CODE
             },
             signInAliases: {
                username: false,
                email: true
             },
             standardAttributes:{
                familyName: {
                    required: true,
                    mutable: false
                }
             },
             passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
                tempPasswordValidity: cdk.Duration.days(3)
             },
             accountRecovery: cognito.AccountRecovery.EMAIL_ONLY
        })

        this.customerPool.addDomain("CustomerDomain", {
            cognitoDomain: {
                domainPrefix: "pcs-customer-service"
            }
        })

        const customerWebScope = new cognito.ResourceServerScope({
            scopeName: "web",
            scopeDescription: "Customer Web operation"
        })
        const customerMobileScope = new cognito.ResourceServerScope({
            scopeName: "mobile",
            scopeDescription: "Customer Mobile operation"
        })
    }

    private createProductsService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
        const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)

        const productsResource = api.root.addResource("products") // "/products"
        productsResource.addMethod("GET", productsFetchIntegration)

        const productIdResource = productsResource.addResource("{id}")
        productIdResource.addMethod("GET", productsFetchIntegration)

        const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

        const productRequestValidator = new apigateway.RequestValidator(this, "ProductRequestValidator", {
            restApi: api,
            requestValidatorName: "Product request validator",
            validateRequestBody: true
        })
        const productModel = new apigateway.Model(this, "ProductModel", {
            modelName: "ProductModel",
            restApi: api,
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties:{
                    productName: { type: apigateway.JsonSchemaType.STRING },
                    code: { type: apigateway.JsonSchemaType.STRING },
                    model: { type: apigateway.JsonSchemaType.STRING },
                    productUrl: { type: apigateway.JsonSchemaType.STRING },
                    price: { type: apigateway.JsonSchemaType.NUMBER },
                },
                required: [ "productName", "code" ]
            }
        })

        productsResource.addMethod("POST", productsAdminIntegration, {
            requestValidator: productRequestValidator,
            requestModels: { "application/json": productModel }
        })

        productIdResource.addMethod("PUT", productsAdminIntegration, {
            requestValidator: productRequestValidator,
            requestModels: { "application/json": productModel }
        })

        productIdResource.addMethod("DELETE", productsAdminIntegration)
    }

    private createOrdersService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
        const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

        //resource - /orders
        const ordersResource = api.root.addResource('orders')

        //GET /orders
        //GET /orders?email=matilde@siecola.com.br
        //GET /orders?email=matilde@siecola.com.br&orderId=123
        ordersResource.addMethod("GET", ordersIntegration)

        const orderDeletionValidator = new apigateway.RequestValidator(this, "OrderDeletionValidator", {
            restApi: api,
            requestValidatorName: "OrderDeletionValidator",
            validateRequestParameters: true
        })
        //DELETE /orders?email=matilde@siecola.com.br&orderId=123
        ordersResource.addMethod("DELETE", ordersIntegration, {
            requestParameters: {
                'method.request.querystring.email': true,
                'method.request.querystring.orderId': true
            },
            requestValidator: orderDeletionValidator
        })

        //POST /orders
        const orderRequestValidator = new apigateway.RequestValidator(this, "OrderRequestValidator", {
            restApi: api,
            requestValidatorName: "Order request validator",
            validateRequestBody: true
        })
        const orderModel = new apigateway.Model(this, "OrderModel", {
            modelName: "OrderModel",
            restApi: api,
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties:{
                    email: { type: apigateway.JsonSchemaType.STRING },
                    productIds: { type: apigateway.JsonSchemaType.ARRAY, minItems: 1, items: { type: apigateway.JsonSchemaType.STRING } },
                    payment: { type: apigateway.JsonSchemaType.STRING, enum: ["CASH", "DEBIT_CARD", "CREDIT_CARD" ] }
                },
                required: [ "email", "productIds", "payment" ]
            }
        })
        ordersResource.addMethod("POST", ordersIntegration, {
            requestValidator: orderRequestValidator,
            requestModels: { "application/json": orderModel }
        })

        // /orders/events
        const orderEventsResource = ordersResource.addResource("events")
        const orderEventsFetchValidator = new apigateway.RequestValidator(this, "OrderEventsFetchValidator", {
            restApi: api,
            requestValidatorName: "OrderEventsFetchValidator",
            validateRequestParameters: true
        })

        const orderEventsFunctionIntegration = new apigateway.LambdaIntegration(props.orderEventsFetchHandler)
        //GET /orders/events?email=matilde@siecola.com.br
        //GET /orders/events?email=matilde@siecola.com.br&eventType=ORDER_CREATED
        orderEventsResource.addMethod('GET', orderEventsFunctionIntegration, {
            requestParameters: {
                'method.request.querystring.email': true,
                'method.request.querystring.eventType': false 
            },
            requestValidator: orderEventsFetchValidator
        })
    }
}