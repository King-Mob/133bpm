// netlify/functions/token.js
//
// This is the one piece of "server" you need. LiveKit access tokens must be
// signed with your API secret, and that secret can never live in browser
// code — so this tiny serverless function signs tokens on request and hands
// back a JWT. It costs nothing to run on Netlify's free tier and there's no
// server for you to manage.

const { AccessToken } = require('livekit-server-sdk');

exports.handler = async (event) => {
  const { room, identity, name } = event.queryStringParameters || {};

  if (!room || !identity) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'room and identity query params are required' }),
    };
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set in Netlify env vars' }),
    };
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: name || identity,
    ttl: '4h',
  });

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  };
};
