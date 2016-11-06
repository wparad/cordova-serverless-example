'use strict';

/**
 * Module dependencies
 */
var fs = require('fs');
var exec = require('child_process').execSync;
var execAsync = require('child_process').spawn;
var glob = require('glob');
var https = require('https');
var path = require('path');

var AwsArchitect = require('aws-architect');
var travis = require('travis-build-tools')(process.env.GIT_TAG_PUSHER);
var version = travis.GetVersion();
var commander = require('commander');
commander.version(version);

//Set default region to test with
var aws = require('aws-sdk');
aws.config.update({ region: 'us-east-1' });

var packageMetadataFile = path.join(__dirname, 'package.json');
var packageMetadata = require(packageMetadataFile);

var apiOptions = {
	sourceDirectory: path.join(__dirname, 'src'),
	description: 'GolfPro Service Lambda',
	regions: ['us-east-1'],
	role: 'golf-pro-service',
	runtime: 'nodejs4.3',
	memorySize: 128,
	publish: true,
	timeout: 10,
	securityGroupIds: [],
	subnetIds: []
};
var contentOptions = {
	contentDirectory: path.join(__dirname, 'content')
};
var awsArchitect = new AwsArchitect(packageMetadata, apiOptions, contentOptions);

commander
	.command('build')
	.description('Setup require build files for npm package.')
	.action(() => {
		packageMetadata.version = version;
		fs.writeFileSync(packageMetadataFile, JSON.stringify(packageMetadata, null, 2));

		console.log("Building package %s (%s)", packageMetadata.name, version);
		console.log('');

		console.log('Running tests');
		var test = exec('npm test');
		console.log(' ' + test);
	});

commander
	.command('run')
	.description('Run lambda web service locally.')
	.action(() => {
		awsArchitect.Run()
		.then((result) => console.log(JSON.stringify(result, null, 2)))
		.catch((failure) => console.log(JSON.stringify(failure, null, 2)));
	});

commander
	.command('deploy')
	.description('Deploy to AWS.')
	.action(() => {
		var databaseSchema = [
			{
				TableName: 'email',
				AttributeDefinitions: [
					{ AttributeName: 'EmailId', AttributeType: 'S' },
					{ AttributeName: 'Time', AttributeType: 'N' }
				],
				KeySchema: [{ AttributeName: 'EmailId', KeyType: 'HASH' }, { AttributeName: 'Time', KeyType: 'RANGE' }],
				ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
			},
			{
				TableName: 'tmpGames',
				AttributeDefinitions: [
					{ AttributeName: 'UserId', AttributeType: 'S' },
					{ AttributeName: 'GameId', AttributeType: 'S' }
				],
				KeySchema: [{ AttributeName: 'UserId', KeyType: 'HASH' }, { AttributeName: 'GameId', KeyType: 'RANGE' }],
				GlobalSecondaryIndexes: [
					{
						IndexName: 'GameIdLookup',
						KeySchema: [{ AttributeName: 'GameId', KeyType: 'HASH' }, { AttributeName: 'UserId', KeyType: 'RANGE' }],
						Projection: { ProjectionType: 'ALL' },
						ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
					}
				],
				ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
			},
			{
				TableName: 'friends',
				AttributeDefinitions: [
					{ AttributeName: 'UserId', AttributeType: 'S' },
					{ AttributeName: 'FriendId', AttributeType: 'S' }
				],
				KeySchema: [{ AttributeName: 'UserId', KeyType: 'HASH' }, { AttributeName: 'FriendId', KeyType: 'RANGE' }],
				// GlobalSecondaryIndexes: [
				// 	{
				// 		IndexName: 'FriendIdLookup',
				// 		KeySchema: [{ AttributeName: 'FriendId', KeyType: 'HASH' }, { AttributeName: 'UserId', KeyType: 'RANGE' }],
				// 		Projection: { ProjectionType: 'ALL' },
				// 		ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
				// 	}
				// ],
				ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
			},
			{
				TableName: 'games',
				AttributeDefinitions: [
					{ AttributeName: 'UserId', AttributeType: 'S' },
					{ AttributeName: 'CompletionTime', AttributeType: 'N' },
					{ AttributeName: 'GameId', AttributeType: 'S' }
					//{ AttributeName: 'CourseId', AttributeType: 'S' },
					//{ AttributeName: 'LeagueId', AttributeType: 'S' },
					//{ AttributeName: 'ScoreCard', AttributeType: 'S' },
				],
				KeySchema: [{ AttributeName: 'UserId', KeyType: 'HASH' }, { AttributeName: 'CompletionTime', KeyType: 'RANGE' }],
				GlobalSecondaryIndexes: [
					{
						IndexName: 'GameIdLookup',
						KeySchema: [{ AttributeName: 'GameId', KeyType: 'HASH' }, { AttributeName: 'UserId', KeyType: 'RANGE' }],
						Projection: { ProjectionType: 'ALL' },
						ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
					}
					/*
					{
						IndexName: 'CourseIdLookup',
						KeySchema: [{ AttributeName: 'UserId', KeyType: 'HASH' }, { AttributeName: 'CourseId', KeyType: 'RANGE' }],
						Projection: { ProjectionType: 'ALL' },
						ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
					},
					*/
					/*
					{
						IndexName: 'LeagueIdLookup',
						KeySchema: [{ AttributeName: 'LeagueId', KeyType: 'HASH' }, { AttributeName: 'GameId', KeyType: 'RANGE' }],
						Projection: { ProjectionType: 'ALL' },
						ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
					}
					*/
				],
				ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
			},
			{
				TableName: 'courseRequest',
				AttributeDefinitions: [
					{ AttributeName: 'UserId', AttributeType: 'S' },
					{ AttributeName: 'GameId', AttributeType: 'S' }
					// { AttributeName: 'IndexedLongitude', AttributeType: 'S' },
					// { AttributeName: 'IndexedLatitude', AttributeType: 'S' },
					//{ AttributeName: 'Name', AttributeType: 'S' },
					//{ AttributeName: 'Par', AttributeType: 'S' },
					//{ AttributeName: 'Location', AttributeType: 'OBJ' },
				],
				KeySchema: [{ AttributeName: 'UserId', KeyType: 'HASH' }, { AttributeName: 'GameId', KeyType: 'RANGE' }],
				// GlobalSecondaryIndexes: [
				// 	{
				// 		IndexName: 'LocationLookup',
				// 		KeySchema: [{ AttributeName: 'IndexedLatitude', KeyType: 'HASH' }, { AttributeName: 'IndexedLongitude', KeyType: 'RANGE' }],
				// 		Projection: { ProjectionType: 'ALL' },
				// 		ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
				// 	}
				// ],
				ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
			},
			{
				TableName: 'users',
				AttributeDefinitions: [
					{ AttributeName: 'UserId', AttributeType: 'S' },
					{ AttributeName: 'UpdateTime', AttributeType: 'N' },
					{ AttributeName: 'NameIndex', AttributeType: 'S' },
					{ AttributeName: 'ShortNameIndex', AttributeType: 'S' }
					// { AttributeName: 'DisplayName', AttributeType: 'S' }
					// { AttributeName: 'Rating', AttributeType: 'N' }
				],
				KeySchema: [{ AttributeName: 'UserId', KeyType: 'HASH' }, { AttributeName: 'UpdateTime', KeyType: 'RANGE' }],
				GlobalSecondaryIndexes: [
					{
						IndexName: 'NameLookup',
						KeySchema: [{ AttributeName: 'NameIndex', KeyType: 'HASH' }, { AttributeName: 'UserId', KeyType: 'RANGE' }],
						Projection: { ProjectionType: 'INCLUDE', NonKeyAttributes: [ 'Info' ] },
						ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 1 }
					},
					{
						IndexName: 'ShortNameLookup',
						KeySchema: [{ AttributeName: 'ShortNameIndex', KeyType: 'HASH' }, { AttributeName: 'UserId', KeyType: 'RANGE' }],
						Projection: { ProjectionType: 'INCLUDE', NonKeyAttributes: [ 'Info' ] },
						ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
					}
					/*
					{
						IndexName: 'RatingLookup',
						KeySchema: [{ AttributeName: 'UserId', KeyType: 'HASH' }, { AttributeName: 'Rating', KeyType: 'RANGE' }],
						Projection: { ProjectionType: 'KEYS_ONLY' },
						ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
					}
					*/
				],
				ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 2 }
			},
			{
				TableName: 'events',
				AttributeDefinitions: [
					{ AttributeName: 'UserId', AttributeType: 'S' },
					{ AttributeName: 'Time', AttributeType: 'N' }
					// { AttributeName: 'EventType', AttributeType: 'S' },
					//{ AttributeName: 'DeviceInformation', AttributeType: 'S' },
				],
				KeySchema: [{ AttributeName: 'UserId', KeyType: 'HASH' }, { AttributeName: 'Time', KeyType: 'RANGE' }],
				// GlobalSecondaryIndexes: [
				// 	{
				// 		IndexName: 'EventTypeLookup',
				// 		KeySchema: [{ AttributeName: 'EventType', KeyType: 'HASH' }, { AttributeName: 'Time', KeyType: 'RANGE' }],
				// 		Projection: { ProjectionType: 'ALL' },
				// 		ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 }
				// 	}
				// ],
				ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 5 }
			}
		];
		Promise.all([awsArchitect.PublishPromise(), awsArchitect.PublishDatabasePromise('prod', databaseSchema)])
		.then((result) => console.log(`${JSON.stringify(result, null, 2)}`))
		.catch((failure) => console.log(`${failure.Details} - ${JSON.stringify(failure, null, 2)}`));
	});

commander.on('*', () => {
	if(commander.args.join(' ') == 'tests/**/*.js') { return; }
	console.log('Unknown Command: ' + commander.args.join(' '));
	commander.help();
	process.exit(0);
});
commander.parse(process.argv[2] ? process.argv : process.argv.concat(['build']));