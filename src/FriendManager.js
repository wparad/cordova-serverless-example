'use strict';

function FriendManager(docClient){
	this.DocClient = docClient;
};

FriendManager.prototype.RemoveFriend = function(body, environment, userId, callback) {
	if(!body.friendIds && body.friendIds.length != 1) {
		return callback({
			statusCode: 400,
			error: 'Unable to delete user, friendId not specified.',
			requestBody: body
		});
	}
	return this.DocClient.delete({
		TableName: `friends.golf-pro.${environment}`,
		Key: {
			UserId: userId,
			FriendId: body.friendIds[0]
		}
	}).promise()
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				info: data
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to remove friend',
			detail: error
		});
	});
};

FriendManager.prototype.AddFriend = function(body, environment, userId, callback) {
	if(!body.friendIds && body.friendIds.length != 1) {
		return callback({
			statusCode: 400,
			error: 'Unable to add user, friendId not specified.',
			requestBody: body
		});
	}
	return this.DocClient.put({
		TableName: `friends.golf-pro.${environment}`,
		Item: {
			UserId: userId,
			FriendId: body.friendIds[0]
		}
	}).promise()
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				info: data
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to add user',
			detail: error
		});
	});
};

FriendManager.prototype.IsFriend = function(friendIds, userId, environment) {
	return this.DocClient.query({
		TableName: `friends.golf-pro.${environment}`,
		ScanIndexForward: false,
		KeyConditionExpression: 'UserId = :id and FriendId = :friendId',
		ExpressionAttributeValues: {
			':id': userId,
			':friendId': friendIds[0]
		}
	}).promise().then(result => result.Items.length > 0)
}
FriendManager.prototype.GetFriends = function(body, environment, userId, callback) {
	return this.DocClient.query({
		TableName: `friends.golf-pro.${environment}`,
		ScanIndexForward: false,
		KeyConditionExpression: 'UserId = :id',
		ExpressionAttributeValues: {
			':id': userId
		}
	}).promise()
	.then(result => {
		return result.Items.map(item => item.FriendId).reduce((promiseChain, friendId) => {
			return promiseChain.then(list => {
				return this.DocClient.query({
					TableName: `users.golf-pro.${environment}`,
					Limit: 1,
					ScanIndexForward: false,
					Select: 'ALL_ATTRIBUTES',
					KeyConditionExpression: 'UserId = :id',
					ExpressionAttributeValues: {
						':id': friendId
					}
				}).promise().then(data => list.concat(data.Items), (failure) => list);
			});
		}, Promise.resolve([]))
	})
	.then(result => {
		return callback({
			statusCode: 200,
			body: {
				friends: result
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to retrieve friends',
			detail: error
		});
	});
};

module.exports = FriendManager;