'use strict;'
var esprima = require('esprima');
var mocha = require('mocha');
var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');

describe('src/RatingProvider.js', function() {
	describe('Syntax', function () {
		it('Should be valid Javascript', function() {
			try {
				var userStringToTest = fs.readFileSync(path.resolve('src/RatingProvider.js'));
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
				var app = require('../src/RatingProvider');
				assert(true);
			}
			catch(e) {
				console.log(e.stack);
				assert(false, e.toString());
			}
		});
	});
	describe('GetRating', function () {
		var holes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
		var RatingProvider = require('../src/RatingProvider');
		var testStaticPar = (aboveBelowPar, expected) => {
			try {
				var ratingProvider = new RatingProvider();
				var par = {};
				var strokes = {};
				holes.forEach(hole => {
					par[hole] = 3;
					strokes[hole] = par[hole] + aboveBelowPar;
				});
				var result = ratingProvider.GetRating(par, strokes);
				assert.strictEqual(result, expected, 'Expected rating does not match actual');
			}
			catch(e) {
				console.error(e.stack);
				assert(false, e.toString());
			}
		};
		it('0', function() {
			testStaticPar(0, 13);
		});
		it('+1', function() {
			testStaticPar(1, 11.48)	;
		});
		it('-1', function() {
			testStaticPar(-1, 14.52);
		});
		it('+4', function() {
			testStaticPar(4, 0.44);
		});
		it('-4', function() {
			testStaticPar(-4, 25.56);
		});
	});
});