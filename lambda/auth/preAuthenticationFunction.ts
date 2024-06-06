import { Callback, Context, PreAuthenticationTriggerEvent } from "aws-lambda";

export async function handler(event: PreAuthenticationTriggerEvent, context: Context, callback: Callback): Promise<void> {
    
    console.log(event)

    if (event.request.userAttributes.email === 'ingridaishy@gmail.com'){
        callback("This user is blocked. Reason: PAYMENT", event)
    } else {
        callback(null, event)
    }
}