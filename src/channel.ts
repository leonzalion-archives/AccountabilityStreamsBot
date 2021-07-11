import { TextChannel, VoiceChannel } from "discord.js";
export let updatesChannel: TextChannel;

export function setUpdatesChannel(channel: TextChannel) {
	updatesChannel = channel;
}

export let voiceChannel: VoiceChannel;

export function setVoiceChannel(channel: VoiceChannel) {
	voiceChannel = channel;
}

export let giftCardChannel: TextChannel;

export function setGiftCardChannel(channel: TextChannel) {
	giftCardChannel = channel;
}
