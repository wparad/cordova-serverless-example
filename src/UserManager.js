'use strict';

const fs = require('fs');

function UserManager(docClient, s3client, imagemagick, friendManager){
	this.DocClient = docClient;
	this.S3client = s3client;
	this.Imagemagick = imagemagick;
	this.FriendManager = friendManager;
};

UserManager.prototype.UploadImage = function(imageDataBase64, userId, bucket) {
	var decodedImage = new Buffer(imageDataBase64, 'base64');
	var path = `/tmp/${new Date().getTime()}-image_decoded.png`;
	var destPath = `/tmp/${new Date().getTime()}-image_resize.png`;
	var params = {
		srcPath: path,
		dstPath: destPath,
		width: 100,
		height: 100,
		quality: 1,
		gravity: "Center"
	};
	var resizePromise = new Promise((s, f) => { fs.writeFile(path, decodedImage, error => error ? f({Error: 'Failed to decode image.', Detail: error.stack || error.toString() }) : s()); })
	.then(() => new Promise((s, f) => { this.Imagemagick.crop(params, error => error ? f({Error: 'Failed to resize image', Detail: error.stack || error.toString()}) : s()); }))
	.then(() => {
		return this.S3client.putObject({
			Bucket: bucket,
			Key: `${userId}/profile.png`,
			Body: fs.createReadStream(destPath)
		}).promise();
	});
	resizePromise.then(() => fs.unlik(path), () => fs.unlik(path)).then(() => fs.unlik(destPath), () => fs.unlik(destPath));
	return resizePromise;
};

UserManager.prototype.SearchForUsers = function(body, environment, userId, callback) {
	var nameIndexPromise = this.DocClient.query({
		TableName: `users.golf-pro.${environment}`,
		IndexName: 'NameLookup',
		ScanIndexForward: false,
		KeyConditionExpression: 'NameIndex = :name',
		ExpressionAttributeValues: {
			':name': body.name ? body.name.slice(0,1).toLowerCase() : null
		}
	}).promise();
	var shortNameIndexPromise = this.DocClient.query({
		TableName: `users.golf-pro.${environment}`,
		IndexName: 'ShortNameLookup',
		ScanIndexForward: false,
		KeyConditionExpression: 'ShortNameIndex = :name',
		ExpressionAttributeValues: {
			':name': body.name ? body.name.slice(0,1).toLowerCase() : null
		}
	}).promise();
	return Promise.all([nameIndexPromise, shortNameIndexPromise])
	.then(result => {
		var unique = {};
		result[0].Items.concat(result[1].Items).map(item => {
			unique[item.UserId] = item;
		});
		return callback({
			statusCode: 200,
			body: {
				users: Object.keys(unique).map(key => unique[key])
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to retrieve friends',
			detail: error.stack || error.toString()
		});
	});
};


UserManager.prototype.HeadUser = function(lookupUser, environment, userId) {
	var isFriendPromise = lookupUser === userId ? Promise.resolve() : this.FriendManager.IsFriend([lookupUser], userId, environment);
	var userPromise = this.DocClient.query({
		TableName: `users.golf-pro.${environment}`,
		Limit: 1,
		ScanIndexForward: false,
		KeyConditionExpression: 'UserId = :id',
		ExpressionAttributeValues: {
			':id': lookupUser
		}
	}).promise().then(result => result.Items[0]);
	return Promise.all([isFriendPromise, userPromise])
	.then(result => {
		var user = result[1];
		if(user) {
			user.FriendData = {
				IsFriend: result[0]
			};
		}
		return user;
	});
};

UserManager.prototype.GetUser = function(body, environment, userId, callback) {
	var lookupUser = body.user || userId;
	return this.HeadUser(lookupUser, environment, userId)
	.then(result => {
		return callback({
			statusCode: 200,
			body: result || {}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: `Unable to retrieve user: ${error.stack || error.toString()}`,
			detail: error
		});
	});
};

module.exports = UserManager;