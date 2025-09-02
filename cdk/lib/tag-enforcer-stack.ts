import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as path from 'path';

export class TagEnforcerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const topic = new sns.Topic(this, 'TagAlertsTopic', { displayName: 'Jaguar FinOps Alerts' });
    const fn = new lambda.Function(this, 'TagEnforcerFn', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'app.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/tag_enforcer')),
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        REQUIRED_TAG_KEYS: 'Owner,Environment,CostCenter,Application',
        DEFAULT_TAGS_JSON: '{"Environment":"sandbox"}',
        ALLOWED_ENV_VALUES: 'prod,staging,dev,sandbox',
        ALERTS_TOPIC_ARN: topic.topicArn
      }
    });
    topic.grantPublish(fn);
    fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['ec2:CreateTags','ec2:DescribeInstances','s3:PutBucketTagging','s3:GetBucketTagging','tag:TagResources','tag:GetResources'], resources: ['*'] }));
    const rule = new events.Rule(this, 'ApiCreateEvents', { eventPattern: { source: ['aws.ec2','aws.s3'], detailType: ['AWS API Call via CloudTrail'], detail: { eventName: ['RunInstances','CreateBucket'] } } });
    rule.addTarget(new targets.LambdaFunction(fn));
    new CfnOutput(this, 'AlertsTopicArn', { value: topic.topicArn });
    new CfnOutput(this, 'TagEnforcerFnName', { value: fn.functionName });
  }
}
