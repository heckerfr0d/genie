const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const ffmpeg = require('fluent-ffmpeg');
const translate = require('@iamtraction/google-translate');
const googleTTS = require('google-tts-api');
const regexp = /(@\d{12} )?(.*):(.*)/;
const rxns = ['😌️','😉️','❤️','👌️','🤏️','✌️','🤙️','🫰️','👍️','🤝️','🫂️'];

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

let sendSticker = async (msg, sms) => {
    const media = await msg.downloadMedia();
    if (media.mimetype && (media.mimetype.includes("image") || media.mimetype.includes("video"))) {
        const result = msg.body.match(regexp);
        const author = result ? result[3] ? result[2] : result[1] : "🧞️";
        const name = result ? result[3] ? result[3] : result[2] : "genie";
        await msg.reply(media, msg.from, { sendMediaAsSticker: sms, stickerAuthor: author, stickerName: name });
    }
}

let sendtts = (msg, text, iso) => {
    googleTTS.getAudioBase64(text, {
        lang: iso,
        slow: false,
        host: 'https://translate.google.com',
        timeout: 50000,
    })
    .then(b64 => {
        const media =  new MessageMedia('audio/mp3', b64);
        msg.reply(media, msg.from, { sendAudioAsVoice: true });
    })
    .catch(console.error);
}

client.on('message', async msg => {
    const chat = await msg.getChat();
    if (!chat.isGroup) {
        const contact = await msg.getContact();
        if (!contact.isMyContact)
            return;
    }

    if (msg.body.startsWith(".help")) {
        await msg.react(rxns[Math.floor(Math.random()*rxns.length)]);
        const helptext = `Know what you wish for:
        \n1. Send an image/video/gif (tag me if in group) and I'll make a sticker for you (specify author:stickername in the image caption to make the sticker with that data)
        \n2. Tag me and say _ss_ on a view once image and I'll send it normally.
        \n3. Send a message in the format \`\`\`.p <query>\`\`\` and I'll scour youtube and send you the audio of the first result.
        \n4. Send a message in the format \`\`\`.d <query>\`\`\` and I'll scour youtube and send you the first result audio as a document.
        \n5. Add me to a group, make me an admin and send a message to the group in the format \`\`\`.a number1 number2...\`\`\` to add the numbers to the group.`
        await msg.reply(helptext, msg.from);
    }

    else if (chat.isGroup && msg.body.startsWith(".a ")) {
        await msg.react(rxns[Math.floor(Math.random()*rxns.length)]);
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
        await msg.react(rxns[Math.floor(Math.random()*rxns.length)]);
        await chat.sendStateRecording();
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
                ffmpeg(audio).save(`./${title}.mp3`).on('end', async () => {
                    const media = MessageMedia.fromFilePath(`./${title}.mp3`);
                    try {
                        await msg.reply(media, msg.from, { sendAudioAsVoice: false });
                    }
                    catch (err) {
                        msg.reply("sorry, couldn't get that");
                        console.error(err);
                    }
                    fs.unlinkSync(`./${title}.mp3`);
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
                fs.unlinkSync(`./${title}.mp3`);
            }
        });
    }

    else if (msg.body.startsWith(".tr ")) {
        await msg.react(rxns[Math.floor(Math.random()*rxns.length)]);
        await chat.sendStateTyping();
        const param = msg.body.split(" ");
        const iso = translate.languages.getISOCode(param[1].toLowerCase());
        if(msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            translate(quotedMsg.body, {to: iso}).then(res => {
                msg.reply(res.text, msg.from);
                if (param.length>2 && param[2] == "tts") {
                    chat.sendStateRecording();
                    sendtts(msg, res.text, iso);
                }
            }).catch(console.error);
        }
        else if (param.length > 2) {
            const iso = translate.languages.getISOCode(param[1].toLowerCase());
            const endi = param.pop() == "tts" ? msg.body.length-3 : undefined;
            translate(msg.body.slice(4+param[1].length, endi), {to: iso}).then(res => {
                msg.reply(res.text, msg.from);
                if (endi) {
                    chat.sendStateRecording();
                    sendtts(msg, res.text, iso);
                }
            }).catch(console.error);
        }
    }

    else if (msg.body.startsWith(".tts ")) {
        await msg.react(rxns[Math.floor(Math.random()*rxns.length)]);
        chat.sendStateRecording();
        const param = msg.body.split(" ");
        const iso = translate.languages.getISOCode(param[1].toLowerCase());
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            sendtts(msg, quotedMsg.body, iso);
        }
        else if (param.length > 2) {
            sendtts(msg, msg.body.slice(5+param[1].length), iso);
        }
    }


    else if (msg.hasMedia && !msg.isStatus) {
        if (chat.isGroup && !(msg.mentionedIds.includes('971507574782@c.us')))
            return;
        await msg.react(rxns[Math.floor(Math.random()*rxns.length)]);
        sendSticker(msg, true);
    }

    else if (msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia && msg.mentionedIds.includes('971507574782@c.us')) {
        await msg.react(rxns[Math.floor(Math.random()*rxns.length)]);
        const quotedMsg = await msg.getQuotedMessage();
        let sms = !msg.body.includes('ss');
        sendSticker(quotedMsg, sms);
    }

    
});

client.initialize();