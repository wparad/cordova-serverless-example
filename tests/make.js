'use strict;'
var esprima = require('esprima');
var mocha = require('mocha');
var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');
var jshint = require('jshint').JSHINT;

describe('make.js', function() {
	describe('Syntax', function () {
		it('Should be valid Javascript', function() {
			try {
				var userStringToTest = fs.readFileSync(path.resolve('make.js'));
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
				var app = require('../make');
				assert(true);
			}
			catch(e) {
				console.log(e.stack);
				assert(false, e.toString());
			}
		});
	});
	describe('Style Checks', function () {
		it('Should be valid Javascript', function() {
			try {
				var userStringToTest = fs.readFileSync(path.resolve('make.js')).toString('UTF-8');
				jshint(userStringToTest, { esversion: 6, node: true});
				assert.strictEqual(jshint.errors.length, 0, 'Erros found through jshint');
				if(jshint.errors.length > 0) {
					console.log(jshint.errors);
				}
			}
			catch(e) {
				console.log(e.stack);
				assert(false, e.toString());
			}
		});
	});
});