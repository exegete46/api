import Axios from "axios";
import { json, Request, Response } from "express";
import { DateTime } from "luxon";
import { ApiClient, StaticAuthProvider } from "twitch";
import User from "../../data/User";

export default async (req: Request, res: Response) => {
  let template_data = {
    displayName: "Universe",
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
  };
  try {
    const response = await Axios.post(
      "https://id.twitch.tv/oauth2/token",
      {},
      {
        params: {
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          code: req.body.code,
          grant_type: "authorization_code",
          redirect_uri: req.body.redirect_uri,
        },
      }
    );
    const { access_token, expires_in, refresh_token } = response.data;

    const authProvider = new StaticAuthProvider(
      process.env.TWITCH_CLIENT_ID,
      access_token
    );
    const api = new ApiClient({ authProvider });
    const me = await api.helix.users.getMe();

    await User.updateOne(
      { twitch_id: me.id },
      {
        $set: {
          access_token: access_token,
          refresh_token: refresh_token,
          next_refresh: DateTime.local()
            .plus({ seconds: Math.min(3600, expires_in) })
            .toISO(),
          twitch_id: me.id,
          twitch_name: me.displayName,
        },
      },
      { upsert: true }
    ).exec();
    const user = await User.findOne({ twitch_id: me.id }).exec();
    template_data.displayName = me.displayName;
    await req.app.get("bot").addUser(user);
    res.json({ twitchId: me.id, twitchDisplayName: me.displayName });
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
};