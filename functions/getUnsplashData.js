// functions/getUnsplashData.js

require('dotenv').config();
const fetch = require('node-fetch');
const api_key = process.env.API_KEY;

exports.handler = async (event, context) => {
    try {
        const api_url = `https://api.unsplash.com/users/paulmatheson/statistics/?client_id=${api_key}`;
        const fetch_response = await fetch(api_url);
        const json = await fetch_response.json();

        return {
            statusCode: 200,
            body: JSON.stringify(json),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    }
};
