import {onRequest} from "firebase-functions/v2/https";
import * as cors from 'cors';
import * as logger from "firebase-functions/logger";
import { JwtPayload, query, verifyToken } from "./helper";

const corsHandler = cors({origin: true});


export const authenticate = onRequest((request, response) => {
  corsHandler(request, response, () => {
    const header = request.headers.authorization;
    if (!header) {
      response.status(401).send('No token provided');
      return;
    }

    const bearer = header.split(' ');
    const token = bearer[1]; // Assuming the Authorization header contains "Bearer [token]"

    const verifiedToken = verifyToken(token);

    if (verifiedToken == "Invalid token") { // Check if the returned value is the error message
      response.status(403).send('Invalid token')
      return;
    }
    const payload = (verifiedToken as JwtPayload)
    // const { content } = request.body;
    logger.info("😈 ")
    let body = JSON.parse(request.body)
    logger.info(body)
    logger.info(body["content"])
    query('INSERT INTO notes(text, email) VALUES($1, $2)', [body["content"], payload.email]);

    // Proceed with the verified JWT
    logger.info("Verified JWT:", { verifiedToken });
    response.send(`Hello from Firebase! User: ${payload.email}`);
  });
});