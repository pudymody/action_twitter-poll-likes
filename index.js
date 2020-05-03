const fs = require("fs").promises;
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
		LAST_TWEET_LIKE = await fs.readFile("LAST_TWEET_LIKE", "utf8");
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

	let tweets_to_process = new_tweets.filter( tw => !LAST_TWEET_LIKE.has(tw.id_str) ).map( tw => {
		tw.frontMatter = {
			date: tw.created_at,
			authorName: tw.user.name,
			authorUrl: "https://twitter.com/" + tw.user.screen_name,
			originalPost: "https://twitter.com/"+ tw.user.screen_name +"/status/" + tw.id_str,
			layout: "like"
		}

		return tw;
	});

	console.log(`Got ${tweets_to_process.length} new tweets.`);
	tweets_to_process = tweets_to_process.reduce(function(prev,curr){
		let date_obj = new Date(curr.frontMatter.date);
		let month = String( date_obj.getUTCMonth() + 1 ).padStart(2, "0");
		let year = date_obj.getUTCFullYear();
		let key = `${year}-${month}`;

		if( !prev.hasOwnProperty(key) ){
			prev[ key ] = [];
		}

		prev[ key ].push(curr);
		return prev;
	}, {});

	for( let [key,likes] of Object.entries(tweets_to_process) ){
		const folder = path.join(BASE, key);
		const folder_index = path.join(folder, "_index.md");

		try {
			await fs.mkdir(folder, { recursive: true });
			await fs.writeFile(folder_index, "");
		} catch (error) {
			if( error.code != "EEXIST" ){
				throw error;
			}
		}

		for( item of likes ){
			let name = "like_" + item.id_str + ".md";
			const file_path = path.join(folder, name);

			content = "---\n";
			content += yaml.safeDump(item.frontMatter);
			content += "---\n";

			await fs.writeFile( file_path, content);
		}

	}

	LAST_TWEET_LIKE = new_tweets.map( tw => tw.id_str );
	await fs.promises.writeFile("LAST_TWEET_LIKE", JSON.stringify(LAST_TWEET_LIKE));
})();
