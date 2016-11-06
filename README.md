# GolfPro Service
This is a Node based lambda microservice package created by AWS-Architect.  To the see the cordova app side take a look at the [Cordova Angular Example](https://github.com/wparad/cordova-angular-example).

## Recent Changes
Visit the [changelog](CHANGELOG.md).

## Prerequisites

* Install NodeJS (4.3 this is what lambda uses) & npm
  ```bash
  curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
* Your user will need access to the following resources (or the continuously deployment user):
	* Development time resources (identical for deployment CI), [example security policy](../deployment-policy.json)
	* Service runtime resources (for testing only, not required, execute lambda, api gateway access, etc...)

## Development
Development is templated using the make.js file. All the needed actions are present there. For ease, the AWS Architect to managed as a npm package. So all functionality is available directly from native nodejs, no having to write shell scripts just do some simple development.

* `npm install`: Install necessary dependencies.
* `node make.js` or `node make.js build`: Builds and run unit tests.
* `sudo npm start`: Runs the microservice locally, it inhabits the api and lambda functions using nodejs express.
* `node make.js deploy`: Deploys the package to AWS.

### Building

  ```bash
  	npm install
  	node make.js
  ```

### Running server locally
AWS Architect uses [OpenAPI Factory](https://github.com/wparad/openapi-factory.js) to convert the `src/index.js` into a node server API used by `node-express`.  This can be loaded, and the server can be started by running

```bash
   npm install
   node make.js run
```