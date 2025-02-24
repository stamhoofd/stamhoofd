import { X2jOptions, XMLParser } from "fast-xml-parser";
import { translateHtml } from "./translate-html";

const parsingOptions: X2jOptions = {
    ignoreAttributes: false,
    preserveOrder: true,
    unpairedTags: ["hr", "br", "link", "meta", 'img'],
    stopNodes : [ "*.pre", "*.script"],
    processEntities: false,
    allowBooleanAttributes: true,
    // unpairedTags: ["unpaired"]
  };

const parser = new XMLParser(parsingOptions);

export async function test() {
    // const text = `<template>
    // <div>
    // <h1>
    //     test {{ title }}
    // </h1>
    // <div v-if="true">true</div>
    // <div v-else>false</div>
    // </div>
    // </template>`;

    const text = ` <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/calculator.svg" :test="'abc'">
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('77e1bb0a-166c-4d37-9dd6-c5ad10a9d91b') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t("64633f7b-2d6e-4ad2-abb1-e9dd77d9a81f") }}
                                </p>
                                <template #right>
                                    <span class="icon external gray" />
                                </template>`;

    const result = await translateHtml(text, {attributeWhiteList: new Set(['test']), doPrompt: true});
    // const result = parser.parse(text);
    // console.log(result[0].template);
}
