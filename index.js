import dotenv from 'dotenv';
import CronJob from "cron";
import Airtable from 'airtable';

dotenv.config();

////////////////////////////

const airtableToken = process.env.AIRTABLE_TOKEN;
const airtableTableId = process.env.AIRTABLE_TABLE_ID;
const spotifySecret = process.env.SPOTIFY_CLIENT_SECRET;
const spotifyClient = process.env.SPOTIFY_CLIENT;
const playlistId = process.env.PLAYLIST_ID;
const base = new Airtable({apiKey: airtableToken}).base(airtableTableId);
const timeSpacing = 1000 * 60 * 4;
let playlistTotal = 0;
let lastList = [];
let spotifyToken;

////////////////////////////

const spotifyCheckPlaylist = async function () {
    try {
        // Create new Spotify Access token and create a date obj for this check

        spotifyToken = await getSpotifyToken();

        let dateVal = new Date();
        const checkDate = new Date(dateVal.valueOf() - timeSpacing);
        
        // Check totals to see if anything new has been added, and exit if not

        const prevTotal = playlistTotal;
        await spotifyCheckTotal();
        
        if (prevTotal == playlistTotal) {
            lastList = [];
            return
        };
        
        // Fetch new items and apply offset

        const offset = playlistTotal - 50; // If offset greater than 50, then we will apply offset
        
        const result = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks${ offset > 0 ? `${'?offset=' + offset}` : ''}`, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + spotifyToken }
        });
        const data = await result.json();
        const tracks = data.items;

        // Vallidate our tracks to ensure they are new and that they were not previously entered
        
        const newTracks = validateTracks(tracks, checkDate);

        // Collect feature information for each track

        const newFeatures = await spotifyCheckFeatures(newTracks);

        // Create objects to be used for airtable
        
        const tracksObj = createTracksObj(newTracks, newFeatures);

        // Update airtable

        tracksObj.forEach(async (track) => {
            await createRecord(track, dateVal)
        });

    } catch (error) {
        console.error(error);
    }
};

////////////////////////////

const spotifyCheckTotal = async function () {
    try {
        const result = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + spotifyToken }
        });
        
        const data = await result.json();
        playlistTotal = data.tracks.total;
    } catch (error) {
        console.error(error);
    }
};

const validateTracks = function (tracksArr, cutoffDate) {
    let tempTrackArr = [];
    let tempLastList = [];
    tracksArr.forEach((track) => {
        let correctedDate = new Date(track.added_at)
        if (!(correctedDate > cutoffDate)) return
        let trackId = track.track.id
        if (lastList.includes(trackId)) return
        tempTrackArr.push(track);
        tempLastList.push(trackId);
    })
    lastList = tempLastList;
    return tempTrackArr
};

const createTracksObj = function (tracksArr, featuresArr) {
    let objArr = []
    for (let i = 0; i < tracksArr.length; i++) {
        const trackObj = {
            'songTitle': tracksArr[i].track.name,
            'artist': collateArtists(tracksArr[i].track.artists),
            'songwriters': '',
            'producers': '',
            'labelInfo': '',
            'popularity': tracksArr[i].track.popularity,
            'danceability': featuresArr[i].danceability,
            'acousticness': featuresArr[i].acousticness,
            'energy': featuresArr[i].energy,
            'loudness': featuresArr[i].loudness,
            'tempo': featuresArr[i].tempo,
            'valence': featuresArr[i].valence,
        }
        objArr.push(trackObj);
    }
    return objArr;
};

const collateArtists = function (artistsArr) {
    let tempArtistArr = [];
    artistsArr.forEach((artist) => {
        tempArtistArr.push(artist.name)
    });
    return tempArtistArr.join(', ')
};

const spotifyCheckFeatures = async function (tracksArr) {
    try {    
        const trackIds = concatIds(tracksArr);
        if (tracksArr.length > 1) {
            const result = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + spotifyToken }
            });
            
            const data = await result.json();
            return data.audio_features;
        } else {
            const result = await fetch(`https://api.spotify.com/v1/audio-features/${trackIds}`, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + spotifyToken }
            });
            
            const data = await result.json();
            return [data];  
        }
    } catch (error) {
        console.error(error);
    }
};

const concatIds = function (tracksArr) {
    let idArr = [];
    tracksArr.forEach((item) => {
        idArr.push(item.track.id)
    });
    
    return idArr.join('%2C');
};

const getSpotifyToken = async function () {
    const result = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(spotifyClient + ':' + spotifySecret)
        },
        body: 'grant_type=client_credentials'
    });

    const data = await result.json();
    return data.access_token;
};

const createRecord = async function (record, dateVal) {
    base('Table 1').create([
        {
        "createdTime": dateVal.toISOString,
        "fields": {
        'Song Title': record.songTitle,
        'Artist': record.artist,
        'Songwriters': '',
        'Producers': '',
        'Label Info': '',
        'Popularity': record.popularity,
        'Danceability': record.danceability,
        'Acousticness': record.acousticness,
        'Energy': record.energy,
        'Loudness': record.loudness,
        'Tempo': record.tempo,
        'Valence': record.valence,
    }
  }
], function(err, records) {
  if (err) {
    console.error(err);
    return;
  }
  records.forEach(function (record) {
    console.log(record.getId());
  });
});
};

////////////////////////////

const mainJob = new CronJob.CronJob(
    '0 */3 * * * *',
    spotifyCheckPlaylist,
    null,
    true,
    'America/Los_Angeles'
);
