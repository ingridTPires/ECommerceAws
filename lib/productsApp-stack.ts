import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as dynadb from "aws-cdk-lib/aws-dynamodb"
import { Construct } from "constructs"

export class ProductsAppStack extends cdk.Stack {
    readonly productsFetchHandler: lambdaNodeJS.NodejsFunction
    readonly productsDdb: dynadb.Table

    constructor(scope: Construct, id: string, props?: cdk.StackProps){
        super(scope, id, props)

        this.productsDdb = new dynadb.Table(this, "ProductsDdb", {
            tableName: "products",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: "id",
                type: dynadb.AttributeType.STRING
            },
            billingMode: dynadb.BillingMode.PROVISIONED,
            readCapacity: 1, //quantas requisições pode receber por segundo
            writeCapacity: 1
        })

        this.productsFetchHandler = new lambdaNodeJS.NodejsFunction(this, 
            "ProductsFetchFunction", {
                functionName: "ProductsFetchFunction",
                entry: "lambda/products/productsFetchFunction.ts",
                handler: "handler", //nome da função
                memorySize: 512,
                runtime:lambda.Runtime.NODEJS_20_X,
                timeout: cdk.Duration.seconds(5),
                bundling:{
                    minify: true,
                    sourceMap: false
                },//como o artefato gerado será empacotado
                environment: {
                    PRODUCTS_DDB: this.productsDdb.tableName
                }
            })

        // da a permissao de leitura á tabela para a role do Handler
        this.productsDdb.grantReadData(this.productsFetchHandler)
    }
}