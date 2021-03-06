import { updatesChannel } from "./channel";
import schedule from "node-schedule";
import Discord from "discord.js";
import { user } from "./user";
import { revealGiftCard } from "./gift-card";
import { scheduleTzJob } from "./schedule";
import tesseract from "node-tesseract-ocr";
import Jimp from "jimp";
import dayjs from "dayjs";

const tesseractConfig = {
	lang: "eng",
	oem: 1,
	psm: 3,
};

let latestSleepCycleMessage: Discord.Message | null = null;

export function requestSleepCycle() {
	updatesChannel.send(
		`${user.toString()}, please send your Sleep Cycle screenshot within the next 15 minutes.`
	);
}

const sleepCycleText =
	"Analysis by Sleep Cycle alarm clock. Download here: https://www.sleepcycle.com/ #sleepCycle";
const userIds = [
	process.env.USER_ID,
	...process.env.ALTERNATIVE_USER_IDS!.split(","),
];

const sleepCycleScreenshotWidth = 1242;
const sleepCycleScreenshotHeight = 2359;

const months = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

function checkSleepCycleDate(dateString: string) {
	console.info(`Matching date string ${dateString}`);
	let matches = dateString.match(
		/(\d+)-(\d+)\s(\w+)|(\d+)\s(\w+)-(\d+)\s(\w+)/
	);

	if (matches === null) {
		return false;
	}

	let secondDateString: string;
	let monthString: string;
	// e.g. 28-29 Jun
	if (matches[1] !== undefined) {
		secondDateString = matches[2];
		monthString = matches[3];
	}
	// e.g. 30 Jun-1 Jul
	else {
		secondDateString = matches[6];
		monthString = matches[7];
	}

	const today = dayjs();
	const todayDate = today.tz().date();
	const todayMonth = today.tz().month();

	const secondDate = Number(secondDateString);

	return secondDate === todayDate && months[todayMonth] === monthString;
}

export function registerSleepCyclePlugin(client: Discord.Client) {
	// Request the sleep cycle message at 8:30AM
	const requestRule = new schedule.RecurrenceRule();
	requestRule.hour = 8;
	requestRule.minute = 30;
	scheduleTzJob(requestRule, () => {
		if (latestSleepCycleMessage === null) {
			requestSleepCycle();
		}
	});

	// Check if the user sent a sleep cycle screenshot at 8:45AM
	const checkRule = new schedule.RecurrenceRule();
	checkRule.hour = 8;
	checkRule.minute = 45;
	scheduleTzJob(checkRule, () => {
		// If user didn't send a sleep cycle screenshot, reset
		if (latestSleepCycleMessage === null) {
			revealGiftCard(
				`${user.toString()} failed to provide a sleep cycle screenshot.`
			);
		}
		latestSleepCycleMessage = null;
	});

	// Reset the sleep cycle screenshot at 12:00AM
	const resetRule = new schedule.RecurrenceRule();
	resetRule.minute = 0;
	resetRule.hour = 0;
	scheduleTzJob(resetRule, () => {
		latestSleepCycleMessage = null;
	});

	client.on("message", async (message) => {
		if (
			message.content.toLowerCase().includes("sleep cycle") &&
			userIds.includes(message.author.id) &&
			message.attachments.size > 0
		) {
			const attachment = message.attachments.first()!;
			if (
				attachment.height === sleepCycleScreenshotHeight &&
				attachment.width === sleepCycleScreenshotWidth
			) {
				const image = await Jimp.read(attachment.url);
				image.crop(50, 100, 950, 150);

				// Finding the right-most white pixel of the image
				let maxX = 0;
				image.scan(
					0,
					0,
					image.bitmap.width,
					image.bitmap.height,
					function (x, y, idx) {
						const red = this.bitmap.data[idx + 0];
						const green = this.bitmap.data[idx + 1];
						const blue = this.bitmap.data[idx + 2];

						if (red === 255 && green === 255 && blue === 255) {
							if (x > maxX) {
								maxX = x;
							}
						}

						// Turn the image black-and-white
						if (red === 6 && green === 22 && blue === 32) {
							this.bitmap.data[idx] = 255;
							this.bitmap.data[idx + 1] = 255;
							this.bitmap.data[idx + 2] = 255;
						} else {
							this.bitmap.data[idx] = 0;
							this.bitmap.data[idx + 1] = 0;
							this.bitmap.data[idx + 2] = 0;
						}
					}
				);
				image.crop(
					maxX + 10,
					0,
					image.getWidth() - maxX - 10,
					image.getHeight()
				);
				const imageBuffer = await image.getBufferAsync("image/jpeg");
				const text = (
					await tesseract.recognize(imageBuffer, tesseractConfig)
				).trim();
				if (checkSleepCycleDate(text)) {
					message.channel.send(`Valid date: ${text}, screenshot accepted.`);
					latestSleepCycleMessage = message;
				} else {
					message.channel.send(`Invalid date: ${text}, screenshot rejected.`);
				}
			}
		}
	});
}
