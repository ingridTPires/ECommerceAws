import { APIGatewayEventDefaultAuthorizerContext } from "aws-lambda";
import { CognitoIdentityServiceProvider } from "aws-sdk";

export class AuthInfoService {
    private congnitoIdentityServiceProvider: CognitoIdentityServiceProvider

    constructor(congnitoIdentityServiceProvider: CognitoIdentityServiceProvider) {
        this.congnitoIdentityServiceProvider = congnitoIdentityServiceProvider
    }

    async getUserInfo(authorizer: APIGatewayEventDefaultAuthorizerContext): Promise<string> {
        const userPoolId = authorizer?.claims.iss.split("amazonaws.com/")[1]
        const username = authorizer?.claims.username

        const user = await this.congnitoIdentityServiceProvider.adminGetUser({
            UserPoolId: userPoolId,
            Username: username
        }).promise()

        const email = user.UserAttributes?.find(attribute => attribute.Name === 'email')
        if(email?.Value){
            return email.Value
        } else {
            throw new Error("Email not found")
        }
    }

    isAdminUser(authorizer: APIGatewayEventDefaultAuthorizerContext): boolean {
        return authorizer?.claims.scope.startsWith("admin")
    }
}