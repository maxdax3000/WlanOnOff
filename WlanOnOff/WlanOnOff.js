const crypto = require('crypto');
const pbkdf2Sync = crypto.pbkdf2Sync;

async function getSid(boxUrl, username, password) {
    try {
        const response = await fetchResponse("http://fritz.box/?login_sid.lua?version=2", "GET");
        const responseText = await response.text();
        const regex = /"(\w+)":([^,]+)/g;
        const pairs = {};
        let match;
        while ((match = regex.exec(responseText)) !== null) {
            const key = match[1];
            const value = match[2];
            pairs[key] = value;
        }
        var challenge = pairs.challenge.replaceAll('"', '');
        var blocktime = pairs.blockTime;
        console.log(challenge)
    } catch (ex) {
        throw ex;
    }
    if (challenge.replace('"', '')
        .startsWith('2$')) {
        console.log('PBKDF2 supported');
        var challengeResponse = calculatePbkdf2Response(challenge, password);
    } else {
        console.log('Falling back to MD5');
        var challengeResponse = calculateMd5Response(challenge, password);
    }
    if (blocktime > 0) {
        console.log(`Waiting for ${blocktime} seconds...`);
        await new Promise(resolve => setTimeout(resolve, blocktime * 1000));
    }
    try {
        const response = await fetchResponse("http://fritz.box/index.lua", "POST", "response=" + challengeResponse + `&username=${username}`);
        const responseText = await response.text();
        const regex = /"sid":"(\w+)"/;
        const match = regex.exec(responseText);
        const sid = match[1];
        if (sid === '0000000000000000') {
            throw new Error('wrong username or password');
        }
        return sid;
    } catch (ex) {
        throw new Error('failed to login');
    }
}

function fetchResponse(url, method, body) {
    try {
        const response = fetch(url, {
            "credentials": "omit",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:107.0) Gecko/20100101 Firefox/107.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "de,en-US;q=0.7,en;q=0.3",
                "Content-Type": "application/x-www-form-urlencoded",
                "Upgrade-Insecure-Requests": "1"
            },
            "referrer": "http://fritz.box/",
            method: method,
            "body": body,
            mode: "cors",
        });
        return response;
    } catch (error) {
        console.error(error);
    }
}

function calculatePbkdf2Response(challenge, password) {
    const challengeParts = challenge.split('$');
    const iter1 = parseInt(challengeParts[1]);
    const salt1 = Buffer.from(challengeParts[2], 'hex');
    const iter2 = parseInt(challengeParts[3]);
    const salt2 = Buffer.from(challengeParts[4], 'hex');
    const hash1 = pbkdf2Sync(password, salt1, iter1, 32, 'sha256');
    const hash2 = pbkdf2Sync(hash1, salt2, iter2, 32, 'sha256');
    return `${challengeParts[4]}$${hash2.toString('hex')}`;
}

function calculateMd5Response(challenge, password) {
    const response = `${challenge}-${password}`;
    const md5Sum = crypto.createHash('md5');
    md5Sum.update(response, 'utf16le');
    return `${challenge}-${md5Sum.digest('hex')}`;
}

async function WlanOnOff(sid) {
    const response = await fetchResponse("http://fritz.box/data.lua", "POST", `xhr=1&sid= ${sid}&lang=de&page=wSet&xhrId=all`);
    const responseText = await response.text();
    const match = responseText.match(/"apActive":"(\w+)"/);
    const apActive = match ? match[1] : null;
    switch (parseInt(apActive)) {
        case 0:
            fetchResponse("http://fritz.box/data.lua", "POST", `xhr=1&sid=${sid}&ssid=Schaltet+euer+Wlan+aus+ihr+Honks&apActive=1&ssidScnd=Schaltet+euer+Wlan+aus+ihr+Honks&apActiveScnd=0&ssidThrd=null&apActiveThrd=null&hiddenSSID=0&differentSSIDs=0&fritzAppFonActive=null&apply=&lang=de&page=wSet`);
            console.log("Wlan an")
            break;
        case 1:
            fetchResponse("http://fritz.box/data.lua", "POST", `xhr=1&sid=${sid}&ssid=Schaltet+euer+Wlan+aus+ihr+Honks&apActive=0&ssidScnd=Schaltet+euer+Wlan+aus+ihr+Honks&apActiveScnd=0&ssidThrd=null&apActiveThrd=null&hiddenSSID=0&differentSSIDs=0&fritzAppFonActive=null&apply=&lang=de&page=wSet`);
            console.log("Wlan aus")
            break;
        default:
            break;
    }
}

async function main() {
    const boxUrl = "https://fritz.box/"
    const username = ""
    const password = ""
    try {
        const sid = await getSid(boxUrl, username, password);
        if (sid) {
            console.log(`Successfully logged in with SID: ${sid}`);
            await WlanOnOff(sid)
        }
    } catch (ex) {
        console.error(ex);
    }
}


main();
