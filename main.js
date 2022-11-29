const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const ffmpeg = require('fluent-ffmpeg');
const regexp = /(@\d{12} )?(.*):(.*)/;


// Use the saved values
const client = new Client({
    // clientId: 'remote'
    authStrategy: new LocalAuth(),
    // puppeteer: {
    //     headless: false,
    //     executablePath: '/usr/bin/google-chrome-stable',
    // }
});

// Save session values to the file upon successful auth
client.on('authenticated', () => {
    console.log('youre in');
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Client is ready!');
});

let sendSticker = async (msg) => {
    const media = await msg.downloadMedia();
    if (media.mimetype && (media.mimetype.includes("image") || media.mimetype.includes("video"))) {
        const result = msg.body.match(regexp);
        const author = result ? result[3] ? result[2] : result[1] : "🧞️";
        const name = result ? result[3] ? result[3] : result[2] : "annen";
        await msg.reply(media, msg.from, { sendMediaAsSticker: true, stickerAuthor: author, stickerName: name });
    }
}

client.on('message', async msg => {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
        const contact = await msg.getContact();
        if (!contact.isMyContact)
            return;
    }

    if (msg.body.startsWith(".help")) {
        const helptext = `Know what you wish for:
        \n1. Send an image/video/gif and I'll make a sticker for you with lub♥️ (specify author:stickername in the image caption to make the sticker with that data)
        \n2. Send a message in the format \`\`\`.p _<query>_\`\`\` and I'll scour youtube and send you the audio of the first result.
        \n3. Send a message in the format \`\`\`.d _<query>_\`\`\` and I'll scour youtube and send you the first result audio as a document.
        \n4. Add me to a group, make me an admin and send a message to the group in the format \`\`\`.a _number1 number2_...\`\`\` to add the numbers to the group.`
        await msg.reply(helptext, msg.from);
    }

    else if (chat.isGroup && msg.body.startsWith(".a ")) {
        let numbers = msg.body.replace("+", "").split(" ");
        numbers.shift();
        for (let i in numbers) {
            if (numbers[i].length < 10)
                return;
            numbers[i] = (numbers[i].length == 10 ? '91' + numbers[i] : numbers[i]) + '@c.us';
        }
        await chat.addParticipants(numbers);
    }

    else if (msg.body.startsWith(".p ") || msg.body.startsWith(".d ")) {
        const param = msg.body.split(" ");
        let url = param[1], title;
        if (!ytdl.validateURL(url)) {
            const query = msg.body.slice(3);
            const filter = await ytsr.getFilters(query);
            const options = filter.get('Type').get('Video');
            const searchResults = await ytsr(options.url, { limit: 1 });
            const video = searchResults.items[0];
            url = video.url;
        }
        const audio = ytdl(url, { quality: 'highestaudio' });
        audio.on('info', (info) => {
            title = info.videoDetails.title.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ");
            if (msg.body.startsWith(".p ")) {
                ffmpeg(audio).audioCodec('opus').save(`./${title}.ogg`).on('end', async () => {
                    const media = MessageMedia.fromFilePath(`./${title}.ogg`);
                    try {
                        await msg.reply(media, msg.from, { sendAudioAsVoice: true });
                    }
                    catch (err) {
                        msg.reply("sorry, couldn't get that");
                        console.error(err);
                    }
                    fs.unlinkSync(`./${title}.ogg`);
                });
            }
            else
                audio.pipe(fs.createWriteStream(`./${title}.mp3`));

        });
        audio.on('finish', async () => {
            if (msg.body.startsWith(".d ")) {
                const media = MessageMedia.fromFilePath(`./${title}.mp3`);
                try {
                    await msg.reply(media, msg.from, { sendMediaAsDocument:true });
                } catch (err) {
                    msg.reply("sorry, couldn't get that");
                    console.error(err);
                }
                fs.unlink(`./${title}.mp3`, (err) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                });
            }
        });
    }


    else if (msg.hasMedia && !msg.isStatus) {
        // const chat = await msg.getChat();
        if (chat.isGroup && !(msg.mentionedIds.includes('971507574782@c.us')))
            return;
        sendSticker(msg);
    }

    else if (msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia && msg.mentionedIds.includes('971507574782@c.us')) {
        const quotedMsg = await msg.getQuotedMessage();
        sendSticker(quotedMsg);
    }

    
});

client.initialize();