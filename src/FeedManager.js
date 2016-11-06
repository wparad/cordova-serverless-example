'use strict';
const xml2js = require('xml2js');

function FeedManager(docClient, http){
	this.DocClient = docClient;
	this.Http = http;
};

var feedDictionary = {
	1: {
		Id: 1,
		Name: 'SkySports | News | Golf',
		Url: 'http://www.skysports.com/rss/12232',
		Icon: 'S'
	},
	2: {
		Id: 2,
		Name: 'Bleacher Report - Golf',
		Url: 'http://bleacherreport.com/articles/feed?tag_id=11',
		Icon: 'B'
	},
	3: {
		Id: 3,
		Name: 'BBC Sport - Golf',
		Url: 'http://feeds.bbci.co.uk/sport/golf/rss.xml?edition=us',
		Icon: 'U'
	},
	// 4: {
	// 	Id: 4,
	// 	Name: 'GeoffShackelford',
	// 	Url: 'http://www.geoffshackelford.com/homepage/rss.xml',
	// 	Icon: 'G'
	// },
	5: {
		Id: 5,
		Name: 'ESPN - Golf',
		Url: 'http://www.espn.com/espn/rss/golf/news',
		Icon: 'E'
	},
	6: {
		Id: 6,
		Name: 'Yahoo Sports - Golf News',
		Url: 'http://sports.yahoo.com/golf/rss.xml',
		Icon: 'Y'
	}
};
FeedManager.prototype.GetFeeds = function(body, environment, userId, callback) {
	return Promise.resolve(Object.keys(feedDictionary).map(id => feedDictionary[id]))
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				feeds: data
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to retrieve feeds',
			detail: error.stack || error.toString()
		});
	});
};

FeedManager.prototype.GetItemsForFeed = function(feedId) {
	if(!feedDictionary[feedId]) { return Promise.resolve([]); }
	return new Promise((s, f) => {
		this.Http.get(feedDictionary[feedId].Url, (res) => {
			var data = ''; 
			res.on('data', (chunk) => {
				data += chunk;
			});
			res.on('end', () => {
				s(data);
			});
			res.on('error', error => {
				f({Error: 'Failed retrieving results', Detail: error});
			});
		});
	}).then(xml => {
		return new Promise((s, f) => new xml2js.Parser().parseString(xml, (error, result) => error ? f({Error: 'Failed to parse xml', Error: error.stack || error.toString(), Detail: error}) : s(result)));
	}).then(feedjs => {
		var feed = feedjs.rss.channel[0];
		var items = feed.item || [];
		return items.map(item => {
			return {
				FeedId: feedId,
				Title: item.title[0],
				Url: item.link[0],
				Headline: item.description[0].replace(/src="(?!https?:\/\/)([^"]+)"/g, `src="${feedjs.rss.channel[0].link}/$1"`),
				Date: item.pubDate[0],
				Id: item.link && item.link[0] ? item.link[0] : item.guid && item.guid[0] ? item.guid[0]['_'] || item.guid[0] : item.title[0]
			};
		});
	}).catch(failure => {
		console.log(`Failed to get feed items for feed: ${feedId} - ${failure.stack || failure.toString()} - ${JSON.stringify(failure, null, 2)}`);
		return [];
	});
};

FeedManager.prototype.GetFeedItems = function(body, environment, userId, callback) {
	return (body.feeds || []).reduce((listPromise, feedId) => {
		return listPromise.then(list => {
			return this.GetItemsForFeed(feedId).then(items => list.concat(items));
		})
	}, Promise.resolve([]))
	.then(data => {
		return callback({
			statusCode: 200,
			body: {
				items: data
			}
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: 'Unable to retrieve feed items',
			detail: error.stack || error.toString()
		});
	});	
};

module.exports = FeedManager;