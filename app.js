const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// ================= CONFIG =================
const endpoint = 'http://127.0.0.1:4566';

// 🔥 S3 (AMAN - TANPA CREDENTIAL)
const s3 = new AWS.S3({
  endpoint: endpoint,
  s3ForcePathStyle: true,
  region: 'us-east-1'
});

// DynamoDB
const dynamodb = new AWS.DynamoDB({
  endpoint: endpoint,
  region: 'us-east-1'
});

const docClient = new AWS.DynamoDB.DocumentClient({
  endpoint: endpoint,
  region: 'us-east-1'
});

const BUCKET = 'bucket-uts';
const TABLE = 'files';

// ================= INIT =================
async function init() {
  try {
    await s3.createBucket({ Bucket: BUCKET }).promise();
    console.log('✅ Bucket ready');
  } catch (e) {
    console.log('Bucket exists');
  }

  try {
    await dynamodb.createTable({
      TableName: TABLE,
      KeySchema: [{ AttributeName: 'filename', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'filename', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    }).promise();

    console.log('✅ Table ready');
  } catch (e) {
    console.log('Table exists');
  }
}
init();

// ================= UPLOAD =================
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const fileContent = fs.readFileSync(req.file.path);

    await s3.putObject({
      Bucket: BUCKET,
      Key: req.file.originalname,
      Body: fileContent,
    }).promise();

    await docClient.put({
      TableName: TABLE,
      Item: {
        filename: req.file.originalname,
        uploadedAt: new Date().toISOString(),
      },
    }).promise();

    fs.unlinkSync(req.file.path);

    res.send('✅ Upload berhasil (S3 + DynamoDB)');
  } catch (err) {
    console.error(err);
    res.send('❌ Upload gagal: ' + err.message);
  }
});

// ================= LIST =================
app.get('/files', async (req, res) => {
  try {
    const data = await docClient.scan({ TableName: TABLE }).promise();
    res.json(data.Items);
  } catch (err) {
    res.send(err.message);
  }
});

app.use(express.static('public'));

app.listen(3000, () => {
  console.log('🚀 Server jalan di http://localhost:3000');
});