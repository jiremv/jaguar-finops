import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as org from 'aws-cdk-lib/aws-organizations';

export class ScpGuardrailsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const scpContent = { Version: '2012-10-17', Statement: [{ Sid: 'DenyCreateIfRequiredTagsMissing', Effect: 'Deny', Action: ['ec2:RunInstances','ec2:CreateVolume','rds:CreateDBInstance','s3:CreateBucket','eks:CreateCluster','ecs:CreateCluster','lambda:CreateFunction'], Resource: '*', Condition: { 'ForAllValues:StringEquals': { 'aws:TagKeys': ['Owner','Environment','CostCenter','Application'] } } }] };
    const scp = new org.CfnPolicy(this, 'RequireTagsSCP', { name: 'RequireTagsOnCreate', type: 'SERVICE_CONTROL_POLICY', content: JSON.stringify(scpContent), description: 'Deny resource creation if required tags are not present in the request.' });
    new CfnOutput(this, 'ScpPolicyId', { value: scp.attrId });
  }
}
