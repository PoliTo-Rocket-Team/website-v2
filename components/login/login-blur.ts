// Tiny inline previews of the /login background photos, so each half paints
// at once while its photo loads (issue #446). Made by scaling each photo in
// public/login/ to 12px wide.
export const loginBlur = {
  "/login/plume.webp":
    "data:image/jpeg;base64,/9j/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAOAAwDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAQQFB//EACMQAAEDAgUFAAAAAAAAAAAAAAECAwQAEQUGEjFBEyEiUVL/xAAUAQEAAAAAAAAAAAAAAAAAAAAF/8QAGBEBAAMBAAAAAAAAAAAAAAAAAQARIQL/2gAMAwEAAhEDEQA/AJEfJUx1pkhaQg9ifmlcQyc8uUS2UkaRe/vmtIVLEDCkLS2FdZJJB4JANGRHaDvinfe9GUmjsZXlKTJ//9k=",
  "/login/gray.webp":
    "data:image/jpeg;base64,/9j/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAOAAwDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQFB//EACIQAAEDAgYDAAAAAAAAAAAAAAECAwQAEQUGEiFBcRMiYf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCVHyXKdaZ9wEHY/KVxHJzrksqbII0i/fNaMZQg4WlaWwrzJJIPBsDQ/HaDmye70H//2Q==",
} as const;

/** A /login background photo: one with a preview in the map above. */
export type LoginPhotoSrc = keyof typeof loginBlur;
