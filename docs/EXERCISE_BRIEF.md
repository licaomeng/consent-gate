# Take-home: Consent Gate

Thanks for getting this far. We'd rather see how you build than talk about it, so here's something small to build.

Give it about an hour. There's more here than fits in an hour, which is fine. Just tell us what you didn't get to.

## The problem

If your product has users under 18, you have to work out what each one is allowed to do before they do it. It depends on how old they are, where they live, and whether a parent has said yes.

You're going to build a small version of that.

## What to build

**A decision service.** Takes a date of birth, a jurisdiction and a feature. Returns one of three answers: allowed, blocked, or needs parental consent. Where consent is needed, you can raise a request and a parent can act on it.

**A page to use it.** One page is plenty. Enter the inputs, see the answer, and act on a pending request as the parent.

Use whatever stack you like. We write Go, TypeScript, React and Next.js against Postgres, so that's easiest for us to read, but don't go learning something new for this. In-memory storage is fine if you'd rather spend the time elsewhere.

## The rules

Your service should read these rather than have them baked in:

```json
{
  "features": ["chat", "purchases", "profile_photo", "video_upload"],
  "rules": [
    { "jurisdiction": "*",     "feature": "profile_photo", "min_age": 13, "if_under": "blocked" },
    { "jurisdiction": "*",     "feature": "chat",          "min_age": 13, "if_under": "parental_consent" },
    { "jurisdiction": "US",    "feature": "chat",          "min_age": 13, "if_under": "parental_consent" },
    { "jurisdiction": "US-CA", "feature": "chat",          "min_age": 16, "if_under": "parental_consent" },
    { "jurisdiction": "US-TX", "feature": "video_upload",  "min_age": 18, "if_under": "blocked" },
    { "jurisdiction": "GB",    "feature": "chat",          "min_age": 13, "if_under": "blocked" },
    { "jurisdiction": "DE",    "feature": "chat",          "min_age": 16, "if_under": "parental_consent" },
    { "jurisdiction": "US",    "feature": "purchases",     "min_age": 18, "if_under": "parental_consent" },
    { "jurisdiction": "DE",    "feature": "purchases",     "min_age": 18, "if_under": "blocked" }
  ]
}
```

Two examples so we're talking about the same thing:

- Born 2015-03-01, in `DE`, asking for `chat`: needs parental consent.
- Born 1990-06-15, in `US`, asking for `purchases`: allowed.

This is about as tidy as rules get in real life. Where they don't cover something, make a call and write down what you picked.

## What we need back

1. The decision endpoint.
2. Consent requests a parent can approve or decline, and change their mind on afterwards.
3. Answers that are right, and stay right.
4. A couple of tests. The ones you'd want if someone else was about to change this code.
5. A `DECISIONS.md`. Anything the rules or this brief left open, what you picked and why, plus whatever you skipped for time. Bullets are fine. We read this one first.
6. An `AI-USE.md`, see below. Keep it short.
7. How to run it, in the README.

## Using AI

Use whatever you normally use. We do, constantly.

Two asks.

Put what you used in `AI-USE.md`, including where it got things wrong and what you threw away. Something like "generated the rule matcher, it just took the first match, which was wrong, so I rewrote it" is the sort of thing we want.

And own what you send us. If you wouldn't defend a line of it, don't send it.

## Sending it back

A repo, link or zip, with whatever's needed to run it. No credentials.

We read these ourselves, and we won't be walking through it with you, so let the `DECISIONS.md` do the talking.
