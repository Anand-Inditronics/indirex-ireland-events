// lib/dynamo.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION_TEST || "ap-south-1",
  endpoint: process.env.DYNAMODB_ENDPOINT_TEST || undefined,
  credentials:
    process.env.AWS_ACCESS_KEY_ID_TEST && process.env.AWS_SECRET_ACCESS_KEY_TEST
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID_TEST,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_TEST,
        }
      : undefined,
});

export const ddb = DynamoDBDocumentClient.from(client);

/**
 * Scan the table (supports filter expressions + pagination).
 * opts:
 *  - tableName
 *  - limit
 *  - exclusiveStartKey
 *  - FilterExpression
 *  - ExpressionAttributeNames
 *  - ExpressionAttributeValues
 */
export async function scanTable(opts: {
  tableName: string;
  limit?: number;
  exclusiveStartKey?: Record<string, any> | undefined;
  FilterExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, any>;
}) {
  const command = new ScanCommand({
    TableName: opts.tableName,
    Limit: opts.limit,
    ExclusiveStartKey: opts.exclusiveStartKey,
    FilterExpression: opts.FilterExpression,
    ExpressionAttributeNames: opts.ExpressionAttributeNames,
    ExpressionAttributeValues: opts.ExpressionAttributeValues,
  });
  return ddb.send(command);
}

/**
 * Query the table (preferred for production scale using PK / GSI).
 * opts:
 *  - tableName
 *  - KeyConditionExpression
 *  - ExpressionAttributeValues
 *  - IndexName?
 *  - Limit?
 *  - ExclusiveStartKey?
 */
export async function queryTable(opts: {
  tableName: string;
  KeyConditionExpression: string;
  ExpressionAttributeValues: Record<string, any>;
  IndexName?: string;
  Limit?: number;
  ExclusiveStartKey?: Record<string, any>;
  ExpressionAttributeNames?: Record<string, string>;
}) {
  const command = new QueryCommand({
    TableName: opts.tableName,
    KeyConditionExpression: opts.KeyConditionExpression,
    ExpressionAttributeValues: opts.ExpressionAttributeValues,
    IndexName: opts.IndexName,
    Limit: opts.Limit,
    ExclusiveStartKey: opts.ExclusiveStartKey,
    ExpressionAttributeNames: opts.ExpressionAttributeNames,
  });
  return ddb.send(command);
}

export async function getItem(opts: {
  tableName: string;
  key: Record<string, any>;
}) {
  const command = new GetCommand({
    TableName: opts.tableName,
    Key: opts.key,
  });
  return ddb.send(command);
}
