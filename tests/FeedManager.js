'use strict;'
var esprima = require('esprima');
var mocha = require('mocha');
var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');

describe('src/FeedManager.js', function() {
	describe('Syntax', function () {
		it('Should be valid Javascript', function() {
			try {
				var userStringToTest = fs.readFileSync(path.resolve('src/FeedManager.js'));
				esprima.parse(userStringToTest);
				assert(true);
			}
			catch(e) {
				console.log(e.stack);
				assert(false, e.toString());
			}
		});
		it('Should be valid node', function(){
			try {
				var app = require('../src/FeedManager');
				assert(true);
			}
			catch(e) {
				console.log(e.stack);
				assert(false, e.toString());
			}
		});
	});
	describe('GetItemsForFeed', function () {
		var FeedManager = require('../src/FeedManager');
		it('http Get', function(done) {
			var httpMock = {
				get: function(url, callback){
					var data = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xml:base="http://www.pga.com/professionalchampionship"  xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
 <title>PGA.com</title>
 <link>http://www.pga.com/professionalchampionship</link>
 <description></description>
 <language>en</language>
<item>
 <title>item 1</title>
 <link>http://www.pga.com/professionalchampionship/news/omar-uresti-takes-command-after-three-rounds</link>
 <description>VERONA, N.Y. (June 28, 2016) &amp;ndash; It may not have been artistic, but Omar Uresti had the formula Tuesday to expand his lead in the 49th PGA Professional Championship at Turning Stone Resort Casino in Verona, New York.

	The 47-year-old PGA Life Member from Austin, Texas, grinded out a...</description>
 <category domain="http://www.pga.com/professionalchampionship/category/year/2016">2016</category>
 <pubDate>Tue, 28 Jun 2016 23:32:57 +0000</pubDate>
 <dc:creator>mcraig</dc:creator>
 <guid isPermaLink="false">16697 at http://www.pga.com/professionalchampionship</guid>
</item>
<item>
 <title>item 2</title>
 <link>http://www.pga.com/professionalchampionship/news/omar-uresti-takes-command-after-three-rounds</link>
 <description>VERONA, N.Y. (June 28, 2016) &amp;ndash; It may not have been artistic, but Omar Uresti had the formula Tuesday to expand his lead in the 49th PGA Professional Championship at Turning Stone Resort Casino in Verona, New York.

  The 47-year-old PGA Life Member from Austin, Texas, grinded out a...&lt;img src="/link.png"&gt;</description>
 <category domain="http://www.pga.com/professionalchampionship/category/year/2016">2016</category>
 <pubDate>Tue, 29 Jun 2016 23:32:57 +0000</pubDate>
 <dc:creator>mcraig</dc:creator>
 <guid>16697 at http://www.pga.com/professionalchampionship</guid>
</item>
</channel>
</rss>`;
					var dataFunction = null;
					var endFunction = null;
					var res = {
						on: function(event, onFunc) {
							if(event == 'data') { dataFunction = onFunc; }
							else if(event == 'end') { endFunction = onFunc; }
						},
						statusCode: 200
					}
					callback(res);
					dataFunction(data);
					endFunction();
				}
			};
			var feedManager = new FeedManager(null, httpMock);
			feedManager.GetItemsForFeed(1)
			.then(result => {
				done();
			}).catch(failure => {
				done(failure);
			});
		});
	});
});