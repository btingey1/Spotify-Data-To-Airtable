# Spotify-Data-To-Airtable

Takes supplied Spotify playlist and extracts various pieces of data related to each song and has a scheduled cron to check every 3 minutes for new songs. All data is then migrated to a linked Airtable.

To setup, create a .env file with the following variables:

AIRTABLE_TOKEN,
AIRTABLE_TABLE_ID,
SPOTIFY_CLIENT_SECRET,
SPOTIFY_CLIENT,
PLAYLIST_ID

Dependencies:
cron,
dotenv,
airtable
