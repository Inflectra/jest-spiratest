const http = require('http');
const https = require('https');
const spiraServiceUrl = "/Services/v5_0/RestService.svc/";
const runnerName = "JestJS"

/**
   * Remove the spaces, special characters, and punctuation from the given string.
   * Used for assigning test cases to individual specs (the it call)
   * @param {string} name 
   */
function compressName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/ig, "")
}

class SpiraReporter {
    constructor(globalConfig, options) {
        /*  Where all executed test runs are put before they are posted to Spira. Here is the format:
         {
         TestCaseId: int
         TestName: string
         RunnerStackTrace: string
         ExecutionStatusId: int
         StartDate: string
         RunnerMessage: string
         ReleaseId: int
         TestSetId: int
         } */
        this.allTestRuns = [];

        this.credentials = {};

        //make sure user has given all the essentials
        if (options.hasOwnProperty("url") && options.hasOwnProperty("username")
            && options.hasOwnProperty("token") && options.hasOwnProperty("projectId")) {
            this.credentials.url = options.url;
            this.credentials.username = options.username;
            this.credentials.token = options.token;
            this.credentials.projectId = options.projectId;
        }
        else {
            //'yell' at them
            console.error("-- SPIRA ERROR --");
            console.error("Please make sure you have the 'url', 'username'," +
                " 'token', and 'projectId' fields defined. This integration" +
                " will not work without them.");
        }
        //make sure the user has test cases taken care of
        if (options.hasOwnProperty("testCases")) {
            this.credentials.testCases = {};
            if (options.testCases.hasOwnProperty("default")) {
                this.credentials.testCases.default = options.testCases.default;
            }
            else {
                console.error("-- SPIRA ERROR --");
                console.error("Please Make sure you have the 'default'" +
                    " field within the 'testCases' object. ");
            }
            //process unique test case names
            for (var property in options.testCases) {
                if (property != "default" && options.testCases.hasOwnProperty(property)) {
                    //remove special characters and spaces and assign to the credentials
                    this.credentials.testCases[compressName(property)] = options.testCases[property];
                }
            }
        }
        else {
            console.error("-- SPIRA ERROR --");
            console.error("Please make sure you have a field called 'testCases'");
        }

        //nonessential properties
        if (options.hasOwnProperty("releaseId")) {
            this.credentials.releaseId = options.releaseId;
        }
        if (options.hasOwnProperty("testSetId")) {
            this.credentials.testSetId = options.testSetId;
        }

    }

    async onRunComplete(contexts, results) {
        await this.postTestRuns();
    }

    onTestResult(test, testResult, aggregatedResult) {
        var results = testResult.testResults;
        results.forEach(e => {
            var newTestRun = {
                TestCaseId: this.credentials.testCases.default,
                RunnerName: runnerName,
                RunnerTestName: e.title,
                RunnerStackTrace: "",
                ExecutionStatusId: -1,
                StartDate: "/Date(" + new Date().getTime() + "-0000)/",
                RunnerMessage: "",
            }

            //assign an individual test case
            for (var property in this.credentials.testCases) {
                if (property != "default" && this.credentials.testCases.hasOwnProperty(property)) {
                    if (compressName(e.title) == property) {
                        newTestRun.TestCaseId = this.credentials.testCases[property];
                    }
                }
            }

            //Add up all the error messages
            e.failureMessages.forEach(fail => {
                newTestRun.RunnerStackTrace += fail + "\n";
            })

            if (e.status == "passed") {
                //2 is passed in Spira
                newTestRun.ExecutionStatusId = 2;
                newTestRun.RunnerMessage = "Test Succeeded";
            }
            else if (e.status == "pending") {
                //3 is Not Run in Spira
                newTestRun.ExecutionStatusId = 3;
                newTestRun.RunnerMessage = "Test Not Run";
            }
            else {
                //1 is failed in Spira
                newTestRun.ExecutionStatusId = 1;
                newTestRun.RunnerMessage = "Test Failed"
            }

            //handle optional release and test set id's
            if (this.credentials.hasOwnProperty("releaseId")) {
                newTestRun.ReleaseId = this.credentials.releaseId;
            }
            if (this.credentials.hasOwnProperty("testSetId")) {
                newTestRun.TestSetId = this.credentials.testSetId;
            }
            this.allTestRuns.push(newTestRun);
        })
    }

    async postTestRuns() {
        return new Promise(resolve => {
            //we will submit all test runs at once
            var url = this.credentials.url + spiraServiceUrl + "projects/" + this.credentials.projectId
                + "/test-runs/record?username=" + this.credentials.username
                + "&api-key=" + this.credentials.token;

            var protocol = http.request;
            if (url.startsWith("https")) {
                protocol = https.request;
                //cut the https:// out of the url
                url = url.substring(8);
            }
            else if (url.startsWith("http")) {
                //cut out the http:// out of the url
                url = url.substring(7);
            }

            var path = url.substring(url.indexOf("/"));
            url = url.substring(0, url.length - path.length);

            var options = {
                host: url,
                path: path,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "accept": "application/json"
                }
            }

            //used to tell how many POST requests were actually made
            var numRequestsMade = 0;

            //tabulate our data into something Spira can read and POST it
            this.allTestRuns.forEach(e => {
                //open the POST request
                var request = protocol(options, (res) => {
                    // console.log(res.statusCode + " : " + res.statusMessage);

                    res.on('data', chunk => {
                        numRequestsMade++;
                        // console.log("RETURN: " + chunk)
                        if (numRequestsMade == this.allTestRuns.length) {
                            //empty array for next suite.
                            this.allTestRuns = [];
                            resolve();
                        }
                    })
                });

                request.on("error", e => {
                    // console.log("Error " + e);
                })

                //actually send the data
                request.write(JSON.stringify(e));
                request.end();

            });
        });
    }

}



module.exports = SpiraReporter;
