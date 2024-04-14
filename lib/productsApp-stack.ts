import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import { Construct } from "constructs"

export class ProductsAppStack extends cdk.Stack {
    readonly productsFetchHandler: lambdaNodeJS.NodejsFunction
    constructor(scope: Construct, id: string, props?: cdk.StackProps){
        super(scope, id, props)

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
                }//como o artefato gerado será empacotado
            })
    }
}