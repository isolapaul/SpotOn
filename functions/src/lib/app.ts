/**
 * Admin SDK init and global options. Every other module imports from here,
 * so this runs before any function is defined.
 */
import {setGlobalOptions} from "firebase-functions/v2";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import {getAuth} from "firebase-admin/auth";

// Set global region to Europe (Frankfurt) for lower latency to Hungary
setGlobalOptions({region: "europe-west3"});

initializeApp();

export const db = getFirestore();
export const messaging = getMessaging();
export const auth = getAuth();
