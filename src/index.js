'use strict';
const aws = require('aws-sdk');
if (!aws.config.region) { aws.config.update({region: 'us-east-1'}); }
const docClient = new aws.DynamoDB.DocumentClient();
const snsClient = new aws.SNS();
const s3Client = new aws.S3();
const geolib = require('geolib');
const _ = require('lodash');
const http = require('http');
const imageMagick = require('imagemagick');

const courseList = require('./courseList.json').courses;
const RatingProvider = require('./RatingProvider');

const GCM_PLATFORM_ARN = 'GCM_PLATFORM_ARN';
const SERVICE_BUCKET = 'SERVICE_BUCKET';

var getCourse = (body, environment, userId, callback) => {
	getCoursePromise(body.id, body.location)
	.then(course => callback(course))
	.catch(error => callback(error));
}
var createCourseRequest = (body, environment, userId, callback) => {
	return docClient.put({
		TableName: `courseRequest.golf-pro.${environment}`,
		Item: {
			UserId: userId,
			GameId: body.gameId,
			Par: body.par,
			Name: body.name,
			Location: body.location,
			IndexedLongitude: norm(body.location.longitude, 2),
			IndexedLatitude: norm(body.location.latitude, 2)
		}
	}).promise()
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				title: 'Request created successfully',
				info: data
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to submit request',
			detail: error
		});
	});
};
var norm = (val, places) => (Math.floor(Number(val) * Math.pow(10, places)) / Math.pow(10, places)).toFixed(places);
var normCourse = (course) => {
	if(Object.keys(course.par).length == 9) {
		Object.keys(course.par).forEach(hole => {
			course.par[hole + 9] = course.par[hole];
		});
	}
	return {
		name: course.name,
		id: course.id,
		par: course.par,
		total: Object.keys(course.par).reduce((total, next) => total + course.par[next], 0)
	}
};

var COURSE_DICTIONARY = {};
var COURSE_INDEX = {};

courseList.map(course => {
	var latNorm = norm(course.latitude, 2);
	var longNorm = norm(course.longitude, 2);
	if(!COURSE_INDEX[latNorm]) { COURSE_INDEX[latNorm] = {}; }
	if(!COURSE_INDEX[latNorm][longNorm]) { COURSE_INDEX[latNorm][longNorm] = []; }
	COURSE_INDEX[latNorm][longNorm].push(course.id);
	COURSE_DICTIONARY[course.id] = course;
});

var getCoursePromise = (id, location) => {
	if(id != null) {
		var course = COURSE_DICTIONARY[id];
		return Promise.resolve({
			statusCode: course ? 200 : 404,
			body: normCourse(course)
		});
	}
	else if(location) { //get course by position
		//calculate possible squares of which location could be in given the possible error.
		//loop over those courses and find the closest possible one to the current location.
		var numLat = Number(norm(location.latitude, 2));
		var numLong = Number(norm(location.longitude, 2));
		var lats = [numLat - 0.01, numLat, numLat + 0.01].map(x => norm(x, 2));
		var longs = [numLong - 0.01, numLong, numLong + 0.01].map(x => norm(x, 2));
		var possibleIds = [];
		lats.map(lat => {
			var possibleLongitudes = COURSE_INDEX[lat];
			longs.map(long => {
				if(possibleLongitudes && possibleLongitudes[long]) { possibleLongitudes[long].map(c => possibleIds.push(c)); }
			});
		});
		if(possibleIds.length == 0) {
			return Promise.reject({
				statusCode: 404,
				error: 'No course found at the current location.',
				requestLocation: location
			});
		}

		var possibleCourses = {};
		possibleIds.map(id => possibleCourses[id] = COURSE_DICTIONARY[id]);
		var bestChoiceCourseId = geolib.findNearest(location, possibleCourses).key;
		var bestCourse = COURSE_DICTIONARY[bestChoiceCourseId];
		return Promise.resolve({
			statusCode: 200,
			body: normCourse(bestCourse)
		});
	}
	else {
		return Promise.reject({
			statusCode: 400,
			error: 'Neither id or location specified.'
		});
	}
};

var getGames = (body, environment, userId, callback) => {
	var table = `games.golf-pro.${environment}`;
	var pageSize = body.pageSize;
	var latestGameDate = body.latestGameDate;

	var totalGamesPromise = docClient.query({
		TableName: `users.golf-pro.${environment}`,
		Limit: 1,
		ScanIndexForward: false,
		KeyConditionExpression: 'UserId = :id',
		ExpressionAttributeValues: {
			':id': userId
		}
	}).promise().then(data => (data.Items[0].Stats || {}).TotalGames || 0);

	var allGamesPromise = docClient.query({
		TableName: table,
		Select: 'ALL_ATTRIBUTES',
		ScanIndexForward: false,
		Limit: pageSize,
		ConsistentRead: true,
		KeyConditionExpression: 'UserId = :value and CompletionTime < :latestGameDate',
		ExpressionAttributeValues: {
			':value': userId,
			':latestGameDate': latestGameDate
		}
	}).promise();
	return Promise.all([totalGamesPromise, allGamesPromise])
	.then(result => {
		var total = result[0];
		var data = result[1];
		return callback({
			statusCode: 200,
			body: {
				title: 'Games retrieved successfully.',
				games: data.Items,
				total: total
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: `Unable to get games: ${error.stack || error.toString()}`,
			detail: error
		});
	});
};

var getTmpRound = (body, environment, userId, callback) => {
	if(!body.gameId) {
		return callback({
			statusCode: 400,
			error: 'GameId must be specified.'
		});
	}

	return docClient.query({
		TableName: `tmpGames.golf-pro.${environment}`,
		IndexName: 'GameIdLookup',
		Select: 'ALL_ATTRIBUTES',
		KeyConditionExpression: 'GameId = :value',
		ExpressionAttributeValues: {
			':value': body.gameId
		}
	}).promise()
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				title: 'Game retrieved successfully.',
				round: {
					games: data.Items
				}
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to get round',
			detail: error
		});
	});
};
var getRound = (body, environment, userId, callback) => {
	if(!body.gameId) {
		return callback({
			statusCode: 400,
			error: 'GameId must be specified.'
		});
	}

	return docClient.query({
		TableName: `games.golf-pro.${environment}`,
		IndexName: 'GameIdLookup',
		Select: 'ALL_ATTRIBUTES',
		KeyConditionExpression: 'GameId = :value',
		ExpressionAttributeValues: {
			':value': body.gameId
		}
	}).promise()
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				title: 'Game retrieved successfully.',
				round: {
					games: data.Items
				}
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to get round',
			detail: error
		});
	});
};

var sendPush = (body, environment, userId, callback) => {
	if(!body.users || !body.update) {
		return callback({
			statusCode: 400,
			error: 'Unable to send update, not all required fields specified: users, update, subject.'
		});
	}

	var androidData = {
		color: '#000000',
		priority: 'high',
		content_available: true,
		data: body.update
	};
	var appleData = {
		color: '#000000',
		priority: 'high',
		content_available: true,
		data: body.update,
		notification: {
			title: body.update.title,
			body: body.update.body
		}
	};
	return body.users.reduce((listPromise, userPushId) => {
		return listPromise.then(list => {
			return snsClient.publish({
				Message: JSON.stringify({
					GCM: JSON.stringify(userPushId.match(/@ios/i) ? appleData : androidData)
				}),
				MessageStructure: 'json',
				TargetArn: userPushId.split('@')[0],
			}).promise().then(() => list.concat([{success: true, user: userPushId}]), (error) => list.concat([{success: false, user: userPushId, error: error}]))
		});
	}, Promise.resolve([]))
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				title: 'Update sent successfully.',
				info: data
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: `Unable to send update: ${error.stack || error.toString()}`,
			detail: error
		});
	});
};
var deleteTmpGame = (body, environment, userId, callback) => {
	return docClient.delete({
		TableName: `tmpGames.golf-pro.${environment}`,
		Key: {
			UserId: userId,
			GameId: body.gameId
		}
	}).promise()
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				title: 'Game deleted successfully',
				info: data.toString(),
				detail: data
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: `Unable to delete game: ${error.stack || error.toString()}`,
			detail: error
		});
	});
};
var putTmpGame = (body, environment, userId, callback) => {
	var updateStrokeDictionary = {};
	Object.keys(body.strokeDictionary)
	.filter(hole => body.strokeDictionary[hole] !== "" && body.strokeDictionary[hole] !== 0 && !isNaN(body.strokeDictionary[hole]))
	.map(hole => {
		updateStrokeDictionary[hole] = Number(body.strokeDictionary[hole]);
	});

	return docClient.put({
		TableName: `tmpGames.golf-pro.${environment}`,
		Item: {
			UserId: userId,
			GameId: body.gameId,
			Strokes: updateStrokeDictionary,
			LastUpdated: new Date().getTime()
		}
	}).promise()
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				title: 'Game saved successfully',
				info: data
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to save game',
			detail: error
		});
	});
};
var putGame = (body, environment, userId, callback) => {
	var updateStrokeDictionary = {};
	Object.keys(body.strokeDictionary)
	.filter(hole => body.strokeDictionary[hole] !== "" && body.strokeDictionary[hole] !== 0 && !isNaN(body.strokeDictionary[hole]))
	.map(hole => {
		updateStrokeDictionary[hole] = Number(body.strokeDictionary[hole]);
	});

	var rating = new RatingProvider().GetRating(COURSE_DICTIONARY[body.courseId].par, updateStrokeDictionary);
	var gameUpdate = docClient.put({
		TableName: `games.golf-pro.${environment}`,
		Item: {
			UserId: userId,
			GameId: body.gameId,
			CourseId: body.courseId,
			Strokes: updateStrokeDictionary,
			CompletionTime: body.completionTime,
			Rating: rating
		}
	}).promise();
	var userUpdate = updateUser(environment, userId, { }, rating);
	return Promise.all([gameUpdate, userUpdate])
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				title: 'Game saved successfully',
				info: data
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to save game',
			detail: error
		});
	});
};

var updatePushIdForUser = (body, environment, userId, callback) => {
	var token = body.token;
	var platformPromise = (body.platform ? Promise.resolve(body.platform) : eventManager.GetPlatform(userId, environment)).then(platform => platform.toLowerCase());
	return docClient.query({
		TableName: `users.golf-pro.${environment}`,
		Limit: 1,
		ScanIndexForward: false,
		KeyConditionExpression: 'UserId = :id',
		ExpressionAttributeValues: {
			':id': userId
		}
	}).promise()
	.then(result => {
		if(!result.Items[0] || !result.Items[0].PushId) {
			var createEndpointPromise = snsClient.createPlatformEndpoint({
				PlatformApplicationArn: GCM_PLATFORM_ARN,
				Token: token,
				CustomUserData: userId
			}).promise();
			return Promise.all([createEndpointPromise, platformPromise])
			.then(result => {
				var data = result[0];
				var platform = result[1];
				return updateUser(environment, userId, { PushId: `${data.EndpointArn}@${platform}` });
			});
		}
		var pushInfo = result.Items[0].PushId;
		var pushId = pushInfo.split('@')[0]
		return snsClient.getEndpointAttributes({EndpointArn: pushId}).promise()
		.then(data => {
			if(data.Attributes.Enabled && data.Attributes.Token == token) { return true; }
			return snsClient.setEndpointAttributes({
				EndpointArn: pushId,
				Attributes: {
					Token: token,
					Enabled: 'true',
					CustomUserData: userId
				}
			}).promise();
		}).then(result => {
			if(pushInfo.includes('@')) { return result; }
			return platformPromise
			.then(platform => updateUser(environment, userId, { PushId: `${pushId}@${platform}` }))
			.then(() => result);
		});
	})
	.then(data => {
		return callback({
			statusCode: 200,
			title: 'Success: pushId set.',
			body: data
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: `Unable to set pushId: ${error.stack || error.toString()}`,
			detail: error
		});
	});
};
var updateUser = (environment, userId, mergeObject, rating) => {
	var table = `users.golf-pro.${environment}`;
	return docClient.query({
		TableName: table,
		Limit: 1,
		ScanIndexForward: false,
		KeyConditionExpression: 'UserId = :id',
		ExpressionAttributeValues: {
			':id': userId
		}
	}).promise()
	.then(result => {
		var currentObject = result.Items[0] || {};
		if(!mergeObject.Stats) { mergeObject.Stats = {}; }
		if(rating) {
			if(!currentObject.Stats || !currentObject.Stats.BestRating || currentObject.Stats.BestRating <= rating) {
				mergeObject.Stats.BestRating = rating;
			}
			var totalGamesInCurrentRating = (currentObject.Stats || {}).TotalGames || 0;
			var currentAverageRating = (currentObject.Stats || {}).AverageRating || 0;
			mergeObject.Stats.AverageRating = (currentAverageRating * totalGamesInCurrentRating + rating) / (totalGamesInCurrentRating + 1);
			mergeObject.Stats.TotalGames = totalGamesInCurrentRating + 1;
			mergeObject.Rating = mergeObject.Stats.AverageRating;
		}
		return _.merge({}, currentObject, mergeObject);
	})
	.then(newObject => {
		var indexName = '*';
		var shortNameIndex = '*';
		if(newObject.Info && newObject.Info.Name && newObject.Info.Name.length > 0) { indexName = newObject.Info.Name.slice(0, 1).toLowerCase(); }
		if(newObject.Info && newObject.Info.ShortName && newObject.Info.ShortName.length > 0) { shortNameIndex = newObject.Info.ShortName.slice(0, 1).toLowerCase(); }
		return docClient.put({
			TableName: table,
			Item: {
				UserId: userId,
				FacebookId: newObject.FacebookId,
				UpdateTime: 0,
				Rating: newObject.Rating,
				Stats: newObject.Stats,
				PushId: newObject.PushId,
				Info: newObject.Info,
				NameIndex: indexName,
				ShortNameIndex: shortNameIndex,
				Profile: newObject.Profile
			}
		}).promise();
	});
};
var putUser = (body, environment, userId, callback) => {
	var profile = body.profile;
	if(profile && profile.Bio === '') { profile.Bio = null; }
	var uploadImagePromise = Promise.resolve();
	if(body.image) {
		var bucket = SERVICE_BUCKET;
		profile.Url = `http://${bucket}.s3-website-us-east-1.amazonaws.com/${userId}/profile.jpg?date=${new Date().getTime()}`;
		//uploadImagePromise = userManager.UploadImage(body.image, userId, bucket);
	}
	var updateUserPromise = updateUser(environment, userId, { FacebookId: body.facebookId, Info: body.info, Profile: profile });
	return Promise.all([updateUserPromise, uploadImagePromise])
	.then(data => {
		return callback({
			statusCode: 200,
			title: `Success: User (${userId}) added to database`,
			result: data.toString(),
			body: {
				url: profile ? profile.Url : null
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: `Unable to $date user (${userId}): ${error.stack || error.toString()}`,
			detail: error
		});
	});
};

var postError = (body, environment, userId, callback) => {
	if(!body.eventType) { body.eventType = 'UnknownError'; }
	return eventManager.CreateEvent(body, environment, userId, callback);
};

var FriendManager = require('./FriendManager');
var friendManager = new FriendManager(docClient);
var UserManager = require('./UserManager');
var userManager = new UserManager(docClient, s3Client, imageMagick, friendManager);
var EventManager = require('./EventManager');
var eventManager = new EventManager(docClient);
var FeedManager = require('./FeedManager');
var feedManager = new FeedManager(docClient, http);

var routes = {
	'/course': {
		'GET': getCourse
	},
	'/courseRequest': {
		'POST': createCourseRequest
	},
	'/game': {
		'PUT': putGame,
		'GET': getGames
	},
	'/tmpgame': {
		'GET': getTmpRound,
		'PUT': putTmpGame,
		'DELETE': deleteTmpGame
	},
	'/round': {
		'GET': getRound
	},
	'/push': {
		'POST': updatePushIdForUser,
		'PUT': sendPush
	},
	'/friends': {
		'POST': (body, environment, userId, callback) => friendManager.AddFriend(body, environment, userId, callback),
		'DELETE': (body, environment, userId, callback) => friendManager.RemoveFriend(body, environment, userId, callback),
		'GET': (body, environment, userId, callback) => friendManager.GetFriends(body, environment, userId, callback)
	},
	'/user': {
		'HEAD': (body, environment, userId, callback) => {
			var lookupUser = body.user || userId;
			return userManager.HeadUser(lookupUser, environment, userId)
			.then(result => {
				return callback({
					statusCode: 200,
					body: result
				});
			})
			.catch(error => {
				return callback({
					statusCode: 400,
					error: `Unable to retrieve user: ${error.stack || error.toString()}`,
					detail: error
				});
			});
		},
		'PUT': putUser,
		'GET': (body, environment, userId, callback) => userManager.GetUser(body, environment, userId, callback)
	},
	'/users' : {
		'POST': (body, environment, userId, callback) => userManager.SearchForUsers(body, environment, userId, callback)
	},
	'/error': {
		'POST': postError
	},
	'/event': {
		'POST': (body, environment, userId, callback) => eventManager.CreateEvent(body, environment, userId, callback)
	},
	'/feeds': {
		'GET': (body, environment, userId, callback) => feedManager.GetFeeds(body, environment, userId, callback)
	},
	'/feed-items': {
		'GET': (body, environment, userId, callback) => feedManager.GetFeedItems(body, environment, userId, callback)
	}
};


exports.handler = (event, context, callback, debug) => {
	var request = {
		Event: event,
		Context: context
	};

	if(!event) {
		if(!debug) { console.error('Event not defined'); }
		return callback({statusCode: 400, error: 'Event not defined.'});
	}
	var httpMethod = event.httpMethod;
	var resourcePath = event.resourcePath;
	var body = event.body;
	var functionVersion = context.functionVersion || 'PROD';
	var environment = functionVersion.match(/LATEST/) ? 'test' : 'prod';

	if(!context.identity || !context.identity.cognitoIdentityId) {
		var logResponse = {
			statusCode: 400,
			error: 'No identity defined',
			detail: {
				api: {
					httpMethod: httpMethod,
					resourcePath: resourcePath
				}
			}
		};
		if(!debug) { console.error(`No Identity defined: ${JSON.stringify(logResponse, null, 2)}`); }
		return callback(logResponse);
	}

	var userId = context.identity.cognitoIdentityId;
	try {
		if(!resourcePath || !httpMethod) {
			var logResponse = {
				statusCode: 400,
				error: 'The API resourcePath or httpMethod were not defined.',
				detail: {
					api: {
						httpMethod: httpMethod,
						resourcePath: resourcePath,
						userId: userId
					},
					requestBody: body
				}
			};
			if(!debug) { console.error(JSON.stringify(logResponse, null, 2)); }
			return callback(null, logResponse);
		}
		if(!routes[resourcePath] || !routes[resourcePath][httpMethod]) {
			var logResponse = {
				statusCode: 400,
				error: 'No route found for that api',
				detail: {
					api: {
						httpMethod: httpMethod,
						resourcePath: resourcePath,
						userId: userId
					},
					requestBody: body
				}
			};
			if(!debug) { console.error(JSON.stringify(logResponse, null, 2)); }
			return callback(null, logResponse);
		}

		return userManager.HeadUser(userId, environment, userId)
		.then(result => {
			if(result) { return true; }
			return putUser({}, environment, userId, () => {});
		})
		.then(() => {
			return routes[resourcePath][httpMethod](body, environment, userId, x => {
				var logResponse = {
					statusCode: x.statusCode,
					request: body,
					response: {
						body: x.detail || x.body,
						message: x.title || x.error
					},
					api: {
						httpMethod: httpMethod,
						resourcePath: resourcePath,
						userId: userId
					}
				};
				if(x.statusCode == null) {
					if(!debug) { console.error(`StatusCode not defined: ${JSON.stringify(logResponse, null, 2)}`); }
					return callback(null, {
						statusCode: 500,
						error: 'statusCode not defined',
						body: x
					});
				}
				else if(logResponse.statusCode >= 400) {
					if(!debug) { console.error(JSON.stringify(logResponse, null, 2)); }
					return eventManager.CreateEvent({
						eventType: 'ApiFailure',
						detail: logResponse
					}, environment, userId, () => { return callback(null, x); });
				}
				if(!debug) { console.log(JSON.stringify(logResponse, null, 2)); }
				return callback(null, x);
			});
		});
	}
	catch(exception) {
		var response = {
			statusCode: 400,
			error: 'Failed to retrieve data',
			detail: {
				exception: exception.stack || exception,
				api: {
					httpMethod: httpMethod,
					resourcePath: resourcePath
				},
				requestBody: body
			}
		};
		if(!debug) { console.log(JSON.stringify(response, null, 2)); }
		return callback(null, response);
	}
};