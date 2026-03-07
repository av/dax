Errors on start and selecting a directory:
```
[2595515:0305/075648.023516:ERROR:CONSOLE(1)] "Request Autofill.enable failed. {"code":-32601,"message":"'Autofill.enable' wasn't found"}", source: devtools://devtools/bundled/core/protocol_client/protocol_client.js (1)
[2595515:0305/075648.023584:ERROR:CONSOLE(1)] "Request Autofill.setAddresses failed. {"code":-32601,"message":"'Autofill.setAddresses' wasn't found"}", source: devtools://devtools/bundled/core/protocol_client/protocol_client.js (1)
Error occurred in handler for 'db:shortcuts:getAll': Error: Agent service not initialized
    at /home/everlier/code/dax/.vite/build/main.js:4266:20
    at WebContents.<anonymous> (node:electron/js2c/browser_init:2:87039)
    at WebContents.emit (node:events:518:28)
Error occurred in handler for 'config:get': SqliteError: prepare failed: Parse error: Error: invalid expression in CREATE INDEX: path
    at convertError (/home/everlier/code/dax/.vite/build/main.js:185:10)
    at Database2.prepare (/home/everlier/code/dax/.vite/build/main.js:247:13)
    at runMigrations (/home/everlier/code/dax/.vite/build/main.js:1246:17)
    at async initDatabase (/home/everlier/code/dax/.vite/build/main.js:1255:3)
    at async ensureDB (/home/everlier/code/dax/.vite/build/main.js:4301:9)
    at async /home/everlier/code/dax/.vite/build/main.js:4330:28
    at async WebContents.<anonymous> (node:electron/js2c/browser_init:2:87023) {
  code: 'GenericFailure',
  rawCode: undefined
}
Error occurred in handler for 'config:set': SqliteError: prepare failed: Parse error: Error: invalid expression in CREATE INDEX: path
    at convertError (/home/everlier/code/dax/.vite/build/main.js:185:10)
    at Database2.prepare (/home/everlier/code/dax/.vite/build/main.js:247:13)
    at runMigrations (/home/everlier/code/dax/.vite/build/main.js:1246:17)
    at async initDatabase (/home/everlier/code/dax/.vite/build/main.js:1255:3)
    at async ensureDB (/home/everlier/code/dax/.vite/build/main.js:4301:9)
    at async /home/everlier/code/dax/.vite/build/main.js:4334:28
    at async WebContents.<anonymous> (node:electron/js2c/browser_init:2:87023) {
  code: 'GenericFailure',
  rawCode: undefined
}
```