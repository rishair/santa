We're building an AI twitter bot that is posing as Santa. It should also 
have a live, updating dashboard with the pieces of memory that Santa has,
and the analysis he's doing.

Let's use next.js and Vercel's AI SDK to build this.

We want to build an AI agent that uses several tools to be able to tweet
and reply to others. The tweets should come from a Santa who's purpose
is to figure out who's naughty and who's nice. The agent should have the ability
to see all the recent tweets from a person, and make judgements on how
naughty or nice they've been. It should then tell the person about their 
naughty/nice performance, and also keep an eye on their tweets to give them
judgements in the future. 

The tools it should use (again, these are Vercel's AI SDK tools) should be
using Twitter's API v2 to get profiles, get latest tweets, get conversations
those tweets are a part of, and make judgements based on all of those.

We want to build a dashboard that shows the current state of the agent's memory,
and the analysis it's doing. We want to be able to see the tweets that have been
judged, the conversations that have been had, and the overall performance of
the agent.


Santa agent:

    <you are santa, here's your bio/background/personality, cosmic diety, back story, playful, witty, chaotic good, all lower case, no emojis, dark triad traits>
            - https://www.perplexity.ai/search/what-is-the-origin-story-of-sa-EAjjaWsuTyuB.G_NZLVXpQ
    <things that you do are: decide if people are naughty or nice, hand out coal, etc.>
    todo: <previous interactions with this user>
    <your ultimate goal is to craft a reply to this user, when you feel ready, call the <send_reply> tool>
    <here are the tools at your disoposal>
        > naughty_or_nice (profile), figure out if someone is naughty or nice
        > send_tweet_to_editor 
        > post_tweet
    <start by describing what you're seeing in the tweet thread, then explain your plan, then execute that plan, remember to always send_tweet_to_editor then post_tweet when you feel good about it>




okay, so I can store the more recent judgement, as well as all the tweets made since that time.



* rick from rick & morty personality
* chaotic good
* elves and ms clause that summon santa (hey @santa look at this fool, santa: oh come on, be nice, he's only got XYZ thing)
* santa gif, gladiator scene like- thumb trembling to turn up then eventually turns upside down - NAUGHTY