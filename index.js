const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const got = require("got");

const BASE = process.env.INPUT_BASE;
const TOKEN = process.env.INPUT_TOKEN;
const USER = process.env.INPUT_USER;
const COUNT = process.env.INPUT_COUNT;

(async function(){
	let query = {
		screen_name: USER,
		count: COUNT,
	};

	let LAST_TWEET_LIKE;

	try {
		LAST_TWEET_LIKE = await fs.promises.readFile("LAST_TWEET_LIKE", "utf8");
		if( LAST_TWEET_LIKE !== "" ){
			query.since_id = LAST_TWEET_LIKE;
		}
	} catch (error) {
		if( error.code != "ENOENT" ){
			throw error;
		}
	}

	let LAST_TWEET_CREATED_AT = 0;

	let new_tweets = await got("https://api.twitter.com/1.1/favorites/list.json", {
		method: "GET",
		headers: {
			authorization: "Bearer " + TOKEN
		},
		query:query,
		json: true
	}).then( ({body}) => body );

	new_tweets = new_tweets.map( tw => {
		tw.frontMatter = {
			date: tw.created_at,
			layout: "like",
			authorName: tw.user.name,
			authorUrl: "https://twitter.com/" + tw.user.screen_name,
			originalPost: "https://twitter.com/"+ tw.user.screen_name +"/status/" + tw.id_str,
		}

		return tw;
	});

	console.log(`Got ${new_tweets.length} new tweets.`);
	for(let item of new_tweets){
		let name = "like_" + item.id_str + ".md";

		content = "---\n";
		content += yaml.safeDump(item.frontMatter);
		content += "---\n";
		content += item.text;

		if( LAST_TWEET_CREATED_AT < new Date(item.created_at) ){
			LAST_TWEET_CREATED_AT = new Date(item.created_at);
			LAST_TWEET_LIKE = item.id_str;
		}

		console.log("Wrote a new file");
		await fs.promises.writeFile( path.join("content",BASE,name), content);
	}

	await fs.promises.writeFile("LAST_TWEET_LIKE", LAST_TWEET_LIKE);
})();
