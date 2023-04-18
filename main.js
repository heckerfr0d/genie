import { BingChat } from 'bing-chat';
import { ChatGPTUnofficialProxyAPI } from 'chatgpt';
import QRCode from 'qrcode';
import fs from 'fs';
import wwebjs from 'whatsapp-web.js';
import ytdl from 'youtube-dl-exec';
import tr from '@iamtraction/google-translate';
import tts from 'google-tts-api';

const { Client, LocalAuth, MessageMedia } = wwebjs;
const youtubedl = ytdl;
const translate = tr;
const googleTTS = tts;

const regexp = /(@\d{12} )?(.*):(.*)/;
const regex = /@[0-9]{12,14}/g;
const rxns = ['😌️', '😉️', '❤️', '👌️', '👍️', '✌️', '🤙️', '🫰️', '🤝️', '🫂️'];

var bresponses = {};
var gresponses = {};
var members = {};
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

const bapi = new BingChat({
    cookie: process.env.BING_COOKIE
});


const gapi = new ChatGPTUnofficialProxyAPI({
    accessToken: process.env.OPENAI_TOKEN,
    apiReverseProxyUrl: 'https://api.pawan.krd/backend-api/conversation'
});

const exitHandler = (options, err) => {
    console.log(err);
    fs.writeFileSync('gresponses.json', JSON.stringify(gresponses));
    console.log('written');
}

// Save session values to the file upon successful auth
client.on('authenticated', () => {
    console.log('youre in');
});

client.on('qr', qr => {
    QRCode.toString(qr, { type: 'terminal', small: true }, (err, url) => {
        console.log(url);
    });
});

client.on('ready', async () => {
    console.log('Client is ready!');
    gresponses = JSON.parse(fs.readFileSync('./gresponses.json', { encoding: 'utf8' }));
    console.log('read');
});

let sendSticker = async (msg, sms) => {
    const media = await msg.downloadMedia();
    if (media.mimetype && (media.mimetype.includes("image") || media.mimetype.includes("video"))) {
        const result = msg.body.match(regexp);
        const author = result ? result[3] ? result[2] : result[1] : "🧞️";
        const name = result ? result[3] ? result[3] : result[2] : "genie";
        await msg.reply(media, msg.from, { sendMediaAsSticker: sms, stickerAuthor: author, stickerName: name });
        await msg.react('✅️');
    }
}

let sendtts = (msg, text, iso) => {
    if (text.length < 200) {
        googleTTS.getAudioBase64(text, {
            lang: iso,
            slow: false,
            host: 'https://translate.google.com',
            timeout: 50000,
        })
        .then(b64 => {
            const media = new MessageMedia('audio/mp3', b64);
            msg.reply(media, msg.from, { sendAudioAsVoice: true });
        })
        .catch(console.error);
    }
    else {
        googleTTS.getAllAudioBase64(text, {
            lang: iso,
            slow: false,
            host: 'https://translate.google.com',
            timeout: 50000,
        })
        .then(async output => {
            for (let op of output) {
                const media = new MessageMedia('audio/mp3', op['base64']);
                await msg.reply(media, msg.from, { sendAudioAsVoice: true });
            }
        })
        .catch(console.error);
    }
    msg.react('✅️');
}


let bing = async (msg, text) => {
    console.log(text);
    let res = await bapi.sendMessage(text, msg.from in bresponses ? bresponses[msg.from] : { variant: 'Creative'});
    console.log('bing');
    msg.react('✅️');
    res['variant'] = 'Creative';
    bresponses[msg.from] = res;
    if (!res.text || res.text.includes('New topic')) {
	console.log(res);
        delete bresponses[msg.from];
    	res = await bapi.sendMessage(text, { variant: 'Creative'});
    	console.log('bing');
	msg.reply(res.text ? res.text : res.detail.hiddenText, msg.from);
    }
    else {
	const mentions = [];
        const matches = res.text.match(regex);
        if (matches) {
            for (const match of matches) {
                mentions.push(await client.getContactById(`${match.slice(1)}@c.us`));
            }
        }
    	msg.reply(res.text.replaceAll('\[\^[0-9]*\^\]', ''), msg.from, { mentions: mentions });
    }
}

let gpt = async (chat, msg, text) => {
    console.log(text);
    try {
    	const res = await gapi.sendMessage(text, msg.from in gresponses ? gresponses[msg.from] : undefined);
    	console.log('gpt');
    	msg.react('✅️');
    	gresponses[msg.from] = { conversationId: res.conversationId, parentMessageId: res.id, onProgress: (partialResponse) => chat.sendStateTyping() };
    	if (!res.text)
            console.log(res);
    	else {
	    const mentions = [];
	    const matches = res.text.match(regex);
	    if (matches) {
	    	for (const match of matches) {
	            mentions.push(await client.getContactById(`${match.slice(1)}@c.us`));
	    	}
	    }
            await msg.reply(res.text, msg.from, { mentions: mentions });
    	}
    }
    catch (err) {
	console.log(err);
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
        msg.react(rxns[Math.floor(Math.random() * rxns.length)]);
        const helptext = `Know what you wish for:
        \n1. _@genie_ on an image/gif/video to make it a sticker.
        \n2. _@genie ss_ on an image/gif/video to send it back.
        \n3. _.p query|link_ to get the audio of first result on youtube.
        \n4. _.d query|link_ to extract and send video from any link.
        \n5. _.gpt query_ to ask the all knowing AI.
        \n6. _.tr target_language [text if not quoted] [tts]_ to translate quoted/given text to target language [and speak].
        \n7. _.tts language [text if not quoted]_ to speak the quoted/given text in the language.
        \n8. _.a number1 [number2...]_ to add the numbers to the group. (I have to be admin)`
        await msg.reply(helptext, msg.from);
        msg.react('✅️');
    }

    else if (chat.isGroup && msg.body.startsWith(".a ")) {
        msg.react(rxns[Math.floor(Math.random() * rxns.length)]);
        let numbers = msg.body.replace("+", "").split(" ");
        numbers.shift();
        for (let i in numbers) {
            if (numbers[i].length < 10)
                return;
            numbers[i] = (numbers[i].length == 10 ? '91' + numbers[i] : numbers[i]) + '@c.us';
        }
        await chat.addParticipants(numbers);
        msg.react('✅️');
    }

    else if (msg.body.startsWith(".p ") || msg.body.startsWith(".d ")) {
        msg.react(rxns[Math.floor(Math.random() * rxns.length)]);
        const param = msg.body.split(" ");
        let url = param[1];
        if (!url.startsWith("http")) {
            url = `ytsearch:${msg.body.slice(3)}`;
        }
        let basename = `result${id++ % 17}`;
        let opts = { noCheckCertificates: true, output: `${basename}.%(ext)s`, cookies: "./cookies.txt" }
        let filename;
        if (msg.body.startsWith(".p ")) {
            chat.sendStateRecording();
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
                try {
                    await msg.reply(media, msg.from, opt2);
        	    msg.react('✅️');
                }
                catch (err) {
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

    }

    else if (msg.body.startsWith(".tr ")) {
        msg.react(rxns[Math.floor(Math.random() * rxns.length)]);
        chat.sendStateTyping();
        const param = msg.body.split(" ");
        const iso = translate.languages.getISOCode(param[1].toLowerCase());
        let txt;
        let endi = undefined;
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            txt = quotedMsg.body;
        }
        else if (param.length > 2) {
            endi = param.pop() == "tts" ? msg.body.length - 3 : undefined;
            txt = msg.body.slice(4 + param[1].length, endi)
        }
        translate(txt, { to: iso }).then(res => {
            msg.reply(res.text, msg.from);
            if (endi) {
                chat.sendStateRecording();
                sendtts(msg, res.text, iso);
            }
        }).catch(console.error);
    }

    else if (msg.body.startsWith(".tts ")) {
        msg.react(rxns[Math.floor(Math.random() * rxns.length)]);
        chat.sendStateRecording();
        const param = msg.body.split(" ");
        const iso = translate.languages.getISOCode(param[1].toLowerCase());
        if (msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            sendtts(msg, quotedMsg.body, iso);
        }
        else if (param.length > 2) {
            sendtts(msg, msg.body.slice(5 + param[1].length), iso);
        }
    }

    else if (msg.body.startsWith(".gpt ")) {
        msg.react(rxns[Math.floor(Math.random() * rxns.length)]);
	let midfix = '';
	if (msg.hasQuotedMsg) {
	    const qmsg = await msg.getQuotedMessage();
	    if (!qmsg.fromMe) {
		midfix = `[${qmsg.author.split('@')[0]}]: ${qmsg.body}`;
	    }
	}
	if (chat.isGroup && !(chat.id in members)) {
	    let part = '\n';
	    for (const elem of chat.participants) {
		if (elem.id._serialized != client.info.wid._serialized) {
		    const contact = await client.getContactById(elem.id._serialized);
		    part += `@${elem.id.user} - ${contact.shortName ? contact.shortName : contact.pushname}\n`;
		}
	    }
	    members[chat.id] = part;
	}
        const prefix = chat.isGroup ? `We are simulating a group chat named ${chat.name}. The part following '[userID]:' is the message sent by the user with ID 'userID'. Other users are mentioned or tagged as '@userID'. Here is a list of the users in the chat:${members[chat.id]}All messages are directed at you. Your name is 'genie' and userID is '971507574782'. You should be as natural, fun, informal and sarcastic as possible and use emojis when appropriate like if it were a real close friends group chat. The message is what you have to reply to, while also remembering context of who said what. If there are multiple messages reply to the last one with context from the other messages.\n${midfix}\n[${msg.author.split('@')[0]}]: ` : '';
        const text = `${prefix}${msg.body.slice(5)}`;
        gpt(chat, msg, text);
    }

    else if (msg.body.startsWith(".bing ")) {
        msg.react(rxns[Math.floor(Math.random() * rxns.length)]);
        chat.sendStateTyping();
	let midfix = '';
        if (msg.hasQuotedMsg) {
            const qmsg = await msg.getQuotedMessage();
            if (!qmsg.fromMe) {
                midfix = `[${qmsg.author.split('@')[0]}]: ${qmsg.body}`;
            }
        }
        const prefix = chat.isGroup ? `We are simulating a group conversation in which I play multiple characters. All dialogues are directed at you. Each dialogue is prefixed by '[characterID]:' of the character being played and other characters can be referred as '@characterID'. Your name is 'genie' and characterID is '971507574782' but your replies do not need any prefix. You should be as natural, fun, informal and sarcastic as possible and use emojis when appropriate like if it were a real chat. The dialogue following '[characterID]:' is what you have to provide an answer to, while also remembering context of who said what.\n${midfix}\n[${msg.author.split('@')[0]}]: ` : '';
        const text = `${prefix}${msg.body.slice(6)}`;
        bing(msg, text);
    }

    else if (msg.hasMedia && !msg.isStatus) {
        if (chat.isGroup && !(msg.mentionedIds.includes('971507574782@c.us')))
            return;
        msg.react(rxns[Math.floor(Math.random() * rxns.length)]);
        sendSticker(msg, true);
    }

    else if (msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia && msg.mentionedIds.includes('971507574782@c.us')) {
        msg.react(rxns[Math.floor(Math.random() * rxns.length)]);
        const quotedMsg = await msg.getQuotedMessage();
        let sms = !msg.body.includes('ss');
        sendSticker(quotedMsg, sms);
    }

});


client.initialize().catch(console.error);


process.on('exit', exitHandler.bind(null,{cleanup:true}));
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
process.on('SIGTERM', exitHandler.bind(null, {exit:true}));
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
