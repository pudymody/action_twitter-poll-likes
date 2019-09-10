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

	let LAST_TWEET_LIKE = new Set();

	try {
		LAST_TWEET_LIKE = await fs.promises.readFile("LAST_TWEET_LIKE", "utf8");
		if( LAST_TWEET_LIKE !== "" ){
			LAST_TWEET_LIKE = JSON.parse(LAST_TWEET_LIKE);
			LAST_TWEET_LIKE = new Set(LAST_TWEET_LIKE);
		}
	} catch (error) {
		if( error.code != "ENOENT" ){
			throw error;
		}
	}

	let new_tweets = await got("https://api.twitter.com/1.1/favorites/list.json", {
		method: "GET",
		headers: {
			authorization: "Bearer " + TOKEN
		},
		query:query,
		json: true
	}).then( ({body}) => body );

	let tweets_to_process = new_tweets.map( tw => {
		tw.frontMatter = {
			date: tw.created_at,
			layout: "like",
			authorName: tw.user.name,
			authorUrl: "https://twitter.com/" + tw.user.screen_name,
			originalPost: "https://twitter.com/"+ tw.user.screen_name +"/status/" + tw.id_str,
		}

		return tw;
	}).filter( tw => !LAST_TWEET_LIKE.has(tw.id_str) );

	console.log(`Got ${tweets_to_process.length} new tweets.`);
	for(let item of tweets_to_process){
		let name = "like_" + item.id_str + ".md";

		content = "---\n";
		content += yaml.safeDump(item.frontMatter);
		content += "---\n";

		console.log("Wrote a new file");
		await fs.promises.writeFile( path.join("content",BASE,name), content);
	}

	LAST_TWEET_LIKE = new_tweets.map( tw => tw.id_str );
	await fs.promises.writeFile("LAST_TWEET_LIKE", JSON.stringify(LAST_TWEET_LIKE));
})();
