const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const sharp = require('sharp');

var app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var awsconfig = {
	"region": "us-east-2",
	"accessKeyId": process.env.accessKeyId,
	"secretAccessKey": process.env.secretAccessKey,
};
AWS.config.update(awsconfig);

var docClient = new AWS.DynamoDB.DocumentClient();
var dynamodb = new AWS.DynamoDB();

const s3 = new AWS.S3();

const OriginalImageUpload = multer({
	storage: multerS3({
		s3: s3,
		bucket: 'magtapp-image-original',
		acl: 'public-read',
		key: (req, file, cb) => {
			cb(null, Date.now().toString() + "-" + file.originalname)
		}
	}),
	fileFilter: (req,file,cb)=>{
		checkFileType(file,cb);
	}
})

const multerS3Obj = multerS3({
	s3 : s3,
	bucket : 'magtapp-image-compressed',
	acl : "public-read",
	contentType : multerS3.AUTO_CONTENT_TYPE,
	metadata : function(req, file, cb) {
			const metadataObj = Object.assign({}, req.body);

			metadataObj.content_type = file.mimetype;
			metadataObj.filename = file.originalname;

			cb(null, metadataObj);
	},
	shouldTransform: function(req, file, cb) {
			cb(null, /^image/i.test(file.mimetype));
	},
	transforms: [
			{
				key: function(req, file, cb) {
					const refType = req.params.refType,
							refId = req.params.refId,
							subfolder = `uploads/${refType}/${refId}/`;
							cb(null, subfolder + file.originalname);
				},
				transform: function(req, file, cb) {
					cb(null, sharp().resize(null,null));
				}
			}
	],
	key: (req, file, cb) => {
		cb(null, Date.now().toString() + "-" + file.originalname)
	}
});

const CompressedImageUpload = multer({
	storage: multerS3Obj,
	fileFilter: (req,file,cb)=>{
		checkFileType(file,cb);
	}
})

checkFileType = (file,cb)=>{
	const filetypes = /jpeg|jpg|png/;
	const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
	const mimetype = filetypes.test(file.mimetype);
	if(mimetype && extname)
		return cb(null,true);
	else
		cb('Error: Images only!');	
}

const SingleUpload = OriginalImageUpload.single('image'); 
const CompressedUpload = CompressedImageUpload.single('image');

app.post('/uploadOriginalImage', (req, res) => {
	SingleUpload(req,res,(err)=>{
		if(err){
			res.status(500).json({error: err});
		}
		else{
			res.json({imageUrl: req.file.location})
		}
	})
})

app.post('/uploadCompressedImage', (req, res) => {
	CompressedUpload(req,res,(err)=>{
		if(err){
			res.status(500).json({error: err});
		}
		else{
			res.json({imageUrl: req.file.location})
		}
	})
})

app.post('/image-meaning',(req,res)=>{
	var {word,meaning,imgloc} = req.body;
	var params = {
		TableName: "Word-Image",
		Item: {
			word: word,
			timestamp: Date.now().toString(),
			meaning: meaning,
			imgloc: imgloc,
		}
	}

	docClient.put(params,(err,data)=>{
		if(err)
			res.status(500).json({error: err});
		else
			res.status(201).json('Record Entered Successfuly');
	})
})

app.post('/compressed-image-meaning',(req,res)=>{
	var {word,meaning,imgloc} = req.body;
	var params = {
		TableName: "compressed-image-word",
		Item: {
			word: word,
			timestamp: Date.now().toString(),
			meaning: meaning,
			imgloc: imgloc,
		}
	}

	docClient.put(params,(err,data)=>{
		if(err)
			res.status(500).json({error: err});
		else
			res.status(201).json('Record Entered Successfuly');
	})
})

app.get('/', (req, res) => {
	res.send('App working fine!');
})

app.listen(process.env.PORT || 3000, () => {
	console.log('App is working!');
})