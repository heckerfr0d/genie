const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
// const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const youtubedl = require('youtube-dl-exec')
// const ffmpeg = require('fluent-ffmpeg');
const translate = require('@iamtraction/google-translate');
const googleTTS = require('google-tts-api');
const regexp = /(@\d{12} )?(.*):(.*)/;
const rxns = ['😌️','😉️','❤️','👌️','🤏️','✌️','🤙️','🫰️','👍️','🤝️','🫂️'];
let id = 0;

// Use the saved values
const client = new Client({
    // clientId: 'remote'
    authStrategy: new LocalAuth(),
     puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium-browser',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--shm-size=1gb'
        ]
     }
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
    // const media = MessageMedia.fromFilePath(`./result2.mp4`);
    // client.sendMessage('918921283149@c.us', media, {sendMediaAsDocument:true});
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
        \n1. _@genie_ on an image/gif/video to make it a sticker.
        \n2. _@genie ss_ on an image/gif/video to send it back.
        \n3. _.p query|link_ to get the audio of first result on youtube.
        \n4. _.d query|link_ to extract and send video from any link.
        \n5. _.tr target_language [text if not quoted] [tts]_ to translate quoted/given text to target language [and speak].
        \n6. _.tts language [text if not quoted]_ to speak the quoted/given text in the language.
        \n5. _.a number1 [number2...]_ to add the numbers to the group. (I have to be admin)`
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
        const param = msg.body.split(" ");
        let url = param[1];
        if (!url.startsWith("http")) {
            const query = msg.body.slice(3);
            const filter = await ytsr.getFilters(query);
            const options = filter.get('Type').get('Video');
            const searchResults = await ytsr(options.url, { limit: 1 });
            const video = searchResults.items[0];
            url = video.url;
        }
        let basename = `result${id++%17}`;
        let opts = { noCheckCertificates: true, output: `${basename}.%(ext)s`, cookies: "./cookies.txt" }
	let filename;
        if (msg.body.startsWith(".p ")) {
            await chat.sendStateRecording();
            opts['extractAudio'] = true;
            opts['format'] = 'ba*';
	    opts['audioFormat'] = 'mp3';
	    filename = `${basename}.mp3`;
	    opts['output'] = basename;
        }
        else {
            opts['maxFilesize'] = '74M';
	    opts['format'] = 'mp4';
	}
        youtubedl(url, opts).then(async output => {
            console.log(output)
	    if (!filename) {
            	fs.readdirSync(__dirname).forEach(file => {
                    if (file.startsWith(basename))
                	filename = file;
            	});
	    }
            if (filename) {
                const media = MessageMedia.fromFilePath(`./${filename}`);
                let opt2 = {}
                if (msg.body.startsWith(".p "))
                    opt2['sendAudioAsVoice'] = false;
                else if (media.data.length > 22666666)
                    opt2['sendMediaAsDocument'] = true;
                msg.react(rxns[Math.floor(Math.random()*rxns.length)]);
                try {
                    await msg.reply(media, msg.from, opt2);
                }
                catch(err) {
                    console.log(err);
                    msg.reply("sorry, couldn't send that");
                }
                fs.unlinkSync(`./${filename}`);
            }
        })
        .catch(err => {
            console.log(err);
            if (err.message.includes("Unsupported URL"))
                msg.reply("Unsupported URL", msg.from);
            else
                msg.reply("sorry couldn't get that.", msg.from);
        });

        // const audio = ytdl(url, { quality: 'highestaudio' });
        // audio.on('info', (info) => {
        //     title = info.videoDetails.title.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ");
        //     if (msg.body.startsWith(".p ")) {
        //         ffmpeg(audio).save(`./${title}.mp3`).on('end', async () => {
        //             const media = MessageMedia.fromFilePath(`./${title}.mp3`);
        //             try {
        //                 await msg.reply(media, msg.from, { sendAudioAsVoice: false });
        //             }
        //             catch (err) {
        //                 msg.reply("sorry, couldn't get that");
        //                 console.error(err);
        //             }
        //             fs.unlinkSync(`./${title}.mp3`);
        //         });
        //     }
        //     else
        //         audio.pipe(fs.createWriteStream(`./${title}.mp3`));

        // });
        // audio.on('finish', async () => {
        //     if (msg.body.startsWith(".d ")) {
        //         const media = MessageMedia.fromFilePath(`./${title}.mp3`);
        //         try {
        //             await msg.reply(media, msg.from, { sendMediaAsDocument:true });
        //         } catch (err) {
        //             msg.reply("sorry, couldn't get that");
        //             console.error(err);
        //         }
        //         fs.unlinkSync(`./${title}.mp3`);
        //     }
        // });
    }

    else if (msg.body.startsWith(".tr ")) {
        await msg.react(rxns[Math.floor(Math.random()*rxns.length)]);
        await chat.sendStateTyping();
        const param = msg.body.split(" ");
        const iso = translate.languages.getISOCode(param[1].toLowerCase());
        let txt;
        let endi = undefined;
        if(msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            txt = quotedMsg.body;
        }
        else if (param.length > 2) {
            endi = param.pop() == "tts" ? msg.body.length-3 : undefined;
            txt = msg.body.slice(4+param[1].length, endi)
        }
        translate(txt, {to: iso}).then(res => {
            msg.reply(res.text, msg.from);
            if (endi) {
                chat.sendStateRecording();
                sendtts(msg, res.text, iso);
            }
        }).catch(console.error);
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

    else if (msg.body.startsWith(".gpt ")) {
        await msg.reply("coming soon");
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

client.initialize().catch(_ => _);
