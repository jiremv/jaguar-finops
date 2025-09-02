import json, os, boto3, logging
from botocore.exceptions import ClientError

log = logging.getLogger()
log.setLevel(logging.INFO)

SNS_ARN = os.environ.get("ALERTS_TOPIC_ARN", "")
REQUIRED_KEYS = [k.strip() for k in os.environ.get("REQUIRED_TAG_KEYS","Owner,Environment").split(",") if k.strip()]
DEFAULT_TAGS = json.loads(os.environ.get("DEFAULT_TAGS_JSON","{}") or "{}")
ALLOWED_ENV = {v.strip() for v in os.environ.get("ALLOWED_ENV_VALUES","prod,staging,dev,sandbox").split(",") if v.strip()}

sns = boto3.client("sns")
ec2 = boto3.client("ec2")
s3  = boto3.client("s3")

def publish_alert(subject: str, message: str):
    if not SNS_ARN:
        log.warning("SNS topic not configured; skipping alert: %s", subject)
        return
    try:
        sns.publish(TopicArn=SNS_ARN, Subject=subject[:100], Message=message[:30000])
    except ClientError as e:
        log.exception("SNS publish failed: %s", e)

def ensure_tags_dict(tag_list):
    if not tag_list:
        return {}
    out = {}
    for t in tag_list:
        k = t.get("Key") or t.get("key")
        v = t.get("Value") or t.get("value")
        if k is not None:
            out[str(k)] = str(v) if v is not None else ""
    return out

def handle_ec2_runinstances(detail):
    ids = []
    try:
        ids = [i["instanceId"] for i in detail.get("responseElements", {}).get("instancesSet", {}).get("items", [])]
    except Exception:
        pass

    req_tags = {}
    for spec in detail.get("requestParameters", {}).get("tagSpecificationSet", {}).get("items", []):
        for t in spec.get("tags", {}).get("items", []):
            k = t.get("key") or t.get("Key")
            v = t.get("value") or t.get("Value")
            if k:
                req_tags[str(k)] = str(v) if v is not None else ""

    missing = [k for k in REQUIRED_KEYS if k not in req_tags or not req_tags[k]]
    bad_env = ("Environment" in req_tags) and (req_tags.get("Environment") not in ALLOWED_ENV)

    if missing or bad_env:
        subj = "Jaguar: EC2 RunInstances tags issue"
        msg = json.dumps({"missing": missing, "bad_env": bad_env, "ids": ids, "provided": req_tags})
        publish_alert(subj, msg)

        final_tags = []
        merged = {**DEFAULT_TAGS, **req_tags}
        for k in REQUIRED_KEYS:
            v = merged.get(k, DEFAULT_TAGS.get(k))
            if v:
                final_tags.append({"Key": k, "Value": str(v)})
        if ids and final_tags:
            try:
                ec2.create_tags(Resources=ids, Tags=final_tags)
                log.info("Applied default tags to instances %s: %s", ids, final_tags)
            except ClientError as e:
                log.warning("Failed to tag EC2: %s", e)

def handle_s3_createbucket(detail):
    bucket = detail.get("requestParameters", {}).get("bucketName")
    if not bucket:
        return
    try:
        existing = {}
        try:
            resp = s3.get_bucket_tagging(Bucket=bucket)
            tagset = resp.get("TagSet", [])
            existing = ensure_tags_dict(tagset)
        except ClientError as e:
            if e.response["Error"]["Code"] != "NoSuchTagSet":
                log.debug("get_bucket_tagging: %s", e)

        merged = {**DEFAULT_TAGS, **existing}
        for k in REQUIRED_KEYS:
            merged.setdefault(k, DEFAULT_TAGS.get(k, ""))

        tagset = [{"Key": k, "Value": str(v)} for k, v in merged.items() if v]
        if tagset:
            s3.put_bucket_tagging(Bucket=bucket, Tagging={"TagSet": tagset})
            log.info("Tagged S3 bucket %s with %s", bucket, tagset)

        missing = [k for k in REQUIRED_KEYS if k not in merged or not merged[k]]
        if missing:
            publish_alert("Jaguar: S3 CreateBucket tags missing", f"Bucket: {bucket}, missing: {missing}")
    except ClientError as e:
        log.warning("S3 tagging failed: %s", e)

def handler(event, context):
    log.info("Event: %s", json.dumps(event))
    detail_type = event.get("detail-type")
    detail = event.get("detail", {})
    name = detail.get("eventName")

    if detail_type == "AWS API Call via CloudTrail":
        if name == "RunInstances":
            handle_ec2_runinstances(detail)
        elif name == "CreateBucket":
            handle_s3_createbucket(detail)
    return {"ok": True}
