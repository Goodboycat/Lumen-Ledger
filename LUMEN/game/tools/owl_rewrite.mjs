// tools/owl_rewrite.mjs — one-shot rewrite of Tally-Owl's lines in data/story.json: fluid, professional sentences instead of
// short clipped "Yoda" fragments. Idempotent (lines already rewritten are left alone). Run from game/: node tools/owl_rewrite.mjs
import fs from 'node:fs';
const FILE = new URL('../data/story.json', import.meta.url);
const MAP = {
  "Welcome, Channeler. I am Tally-Owl. I kept the books for your grandmother, and I kept them honest.":
    "Welcome, Channeler. My name is Tally-Owl, and I kept your grandmother's books for many years, which means I also kept them honest.",
  "The bad news: Glowmarket owes Baron Gilt 200 Spark. The purple haze over the pier is his Debt Fog. It grows when we borrow or overspend.":
    "Let me start with the bad news: Glowmarket currently owes Baron Gilt 200 Spark, and that purple haze over the pier is his Debt Fog, which grows every time we borrow or overspend.",
  "You have 500 Spark, a hammer, and me. Build a stall, sell to the Glimmers, and route every coin into the four jars: Spend, Save, Invest, Protect.":
    "The good news is that you have 500 Spark, a hammer and me. Build a stall, sell to the Glimmers, and route every coin you earn into the four jars: Spend, Save, Invest and Protect.",
  "Halfway through the season. Look at the jars, not the pile: a plan for your Spark is worth more than a heap of it.":
    "We are halfway through the season, so this is a good moment to look at the jars rather than the pile, because a plan for your Spark is worth more than a heap of it.",
  "First ledger. Income in, upkeep out, and a little left for the jars. That is a budget — nothing fancier than that.":
    "Here is your first ledger: income came in, upkeep went out, and a little was left over for the jars. That is all a budget really is, nothing fancier than that.",
  "The books are thin, but they are open. Nobody budgets perfectly on the first try — the trick is to try again next season.":
    "The books are thin this season, but they are open and honest, and nobody budgets perfectly on the first try. The trick is simply to try again next season with what you learned.",
  "Three stars on your first ledger. Your grandmother would have made a very undignified hooting noise.":
    "Three stars on your very first ledger. I believe your grandmother would have made a rather undignified hooting noise at this.",
  "Imagine the fruit stall with a roof that does not leak. Which one keeps the Glimmers coming back?":
    "Now imagine the fruit stall with a roof that does not leak, and ask yourself which of the two actually keeps the Glimmers coming back.",
  "Needs first: upkeep, repairs, the walk to the pier. Wants wait one season. They do not spoil.":
    "Needs come first, and that means upkeep, repairs and the walk to the pier. Wants can wait one season, because unlike fruit they do not spoil.",
  "A quick test for every purchase: if I skip this, does anything break? If nothing breaks, it is a want.":
    "Here is a quick test you can apply to every purchase: if you skip it, does anything break? If nothing breaks, then it is a want rather than a need.",
  "Needs paid, a want or two bought, and the Fog held still. A sensible season.":
    "You paid every need, bought a want or two, and the Fog held still, which makes this a thoroughly sensible season.",
  "The Fog grew. Somewhere a want jumped the queue in front of a need. It happens — now you know what it costs.":
    "The Fog grew this season, which usually means a want jumped the queue in front of a need somewhere. It happens to everyone, and now you know exactly what it costs.",
  "Every need covered, Fog pushed back, and you still had Spark left for Save. That is how markets grow old gracefully.":
    "Every need was covered, the Fog was pushed back, and you still had Spark left over for Save. That is how a market grows old gracefully.",
  "Grey clouds over the Far Point. Spark Storms come this time of year. They do not send invitations.":
    "There are grey clouds gathering over the Far Point, and Spark Storms tend to arrive at this time of year without sending an invitation first.",
  "They break things. Broken things cost Spark. If the Spark is in Protect, a storm is a bill. If it is not, a storm is a loan — from him.":
    "They break things, and broken things cost Spark. If that Spark is already sitting in Protect, a storm is just a bill; if it is not, a storm becomes a loan, and the lender will be him.",
  "The Protect jar looks idle. Idle is the point — it is the only jar that works hardest on your worst day.":
    "The Protect jar may look idle, but that is entirely the point, because it is the one jar that works hardest on your worst day.",
  "The storm came, Protect paid, and the Baron went home hungry. That is what an emergency fund is for.":
    "The storm came, Protect paid for the damage, and the Baron went home hungry, which is precisely what an emergency fund is for.",
  "The storm hit an empty Protect jar, and the Fog rolled in to fill the gap. Refill it before the next one.":
    "The storm hit an empty Protect jar, so the Fog rolled in to fill the gap. I would refill it before the next one arrives.",
  "Protect was full, the storm was a shrug, and the Fog actually shrank. Grandmother used to call that 'boring'. Boring is beautiful.":
    "Protect was full, the storm barely registered, and the Fog actually shrank. Your grandmother used to call seasons like this boring, and I have always found boring rather beautiful.",
  "It is working. Save pays you 5 % every season. That is good interest — Spark that works while you sleep.":
    "It is working as intended: Save pays you 5 % every season, and that is what good interest looks like, Spark that keeps working while you sleep.",
  "The Baron's loan is the same word pointing the other way: 20 % a season, growing on top of itself. Bad interest works while you sleep too — against you.":
    "The Baron's loan is the same word pointing the other way, 20 % a season growing on top of itself. Bad interest also works while you sleep, except that it works against you.",
  "Every coin you repay is a coin the Baron can never charge interest on again. That is the best return on the island.":
    "Every coin you repay is a coin the Baron can never charge interest on again, which makes repayment the best return available anywhere on this island.",
  "Interest earned on one line, interest paid on the other. Make the first number bigger than the second, every season, and the Fog has nowhere to grow.":
    "Interest earned sits on one line and interest paid on the other. If you make the first number bigger than the second every season, the Fog simply has nowhere left to grow.",
  "The Baron earned more from you than Save earned for you. Flip that next season — repay before you spend.":
    "This season the Baron earned more from you than Save earned for you. Let us flip that next season by repaying before you spend.",
  "Debt down, Save up, and the gap between them is where the Fog used to live. Three stars.":
    "Debt went down, Save went up, and the gap between them is exactly where the Fog used to live. That earns you three stars.",
  "The Baron has grown bored of waiting. Expect visitors with wonderful offers. Wonderful offers are his second favourite word.":
    "The Baron has grown bored of waiting, so expect visitors bearing wonderful offers. I should mention that 'wonderful offer' is his second favourite phrase.",
  "Precisely. A real offer survives a night's sleep. A Too-Good Deal cannot — it needs you to decide before you think.":
    "Precisely. A genuine offer survives a night's sleep, whereas a Too-Good Deal cannot, because it depends on you deciding before you have had time to think.",
  "Look for the tells: hurry, secrecy, 'guaranteed', and his personal favourite — a tiny asterisk.":
    "Look for the tells: a sense of hurry, a request for secrecy, the word 'guaranteed', and his personal favourite, a very tiny asterisk.",
  "Nobody guarantees growth. Anyone who does is not selling growth — they are selling you.":
    "Nobody can guarantee growth, and anyone who claims to is not really selling growth at all. What they are selling is you.",
  "Offers came and went and the jars are where you left them. Saying 'no' is the cheapest financial tool ever invented.":
    "Offers came and went, and the jars are exactly where you left them. Saying no remains the cheapest financial tool ever invented.",
  "A deal that looked too good was exactly as good as it looked. Expensive lesson — cheaper now than later.":
    "A deal that looked too good turned out to be exactly as good as it looked. It was an expensive lesson, but it is far cheaper to learn it now than later.",
  "Every Too-Good Deal refused, every tell spotted. The Collectors have started avoiding your pier.":
    "You refused every Too-Good Deal and spotted every tell, and I notice the Collectors have started avoiding your pier altogether.",
  "Interest earned interest. The jar is now paying you on the Spark it paid you earlier. That is compounding — the good kind.":
    "Your interest has started earning interest of its own, so the jar is now paying you on the Spark it already paid you earlier. That is compounding, and this is the good kind.",
  "Small, early, left alone. Those three words have built more lighthouses than any treasure chest.":
    "Start small, start early, and leave it alone. Those three habits have built more lighthouses than any treasure chest ever did.",
  "Invest grows faster than Save but wobbles. Save is the tortoise. The island has room for both.":
    "Invest grows faster than Save, but it wobbles along the way, while Save is the steady tortoise. The island has room for both of them.",
  "Growth on growth. The calendar did half of this season's work for you — and it never asks for upkeep.":
    "That is growth on top of growth. The calendar did half of this season's work for you, and the calendar never asks for upkeep.",
  "An emptied Save jar cannot compound. Every withdrawal resets the quiet work. Let it sit next season.":
    "An emptied Save jar cannot compound, because every withdrawal resets all of its quiet work. Try to let it sit untouched next season.",
  "Save, Invest and the stalls all grew on top of last season's growth. This is the season the island started paying for itself.":
    "Save, Invest and the stalls all grew on top of last season's growth, which makes this the season the island started paying for itself.",
  "Real cover names exactly what it covers and exactly how you claim. If there are no terms, there is no cover — only a fee.":
    "Real cover tells you exactly what it covers and exactly how you make a claim. If there are no terms, then there is no cover, only a fee.",
  "The Protect jar. It absorbs storms, leaky roofs and Collector 'levies' so one bad day cannot undo a good season. The Guard Tortoise makes it absorb more.":
    "That would be the Protect jar. It absorbs storms, leaky roofs and Collector 'levies' so that one bad day cannot undo a good season, and the Guard Tortoise helps it absorb even more.",
  "Insurance feels wasted every season nothing happens. That feeling is the price. It is still cheaper than the Fog.":
    "Insurance feels wasted in every season where nothing happens, but that feeling is simply the price of being covered, and it is still far cheaper than the Fog.",
  "Shocks came, Protect took them, the season stayed whole. Cover does its best work when nobody notices.":
    "Shocks came, Protect absorbed them, and the season stayed whole. Good cover does its best work when nobody notices it at all.",
  "Protect ran dry and the Fog filled the gap. Top it up before chasing another stall — defence first this time.":
    "Protect ran dry and the Fog filled the gap. I would top it up before chasing another stall, with defence coming first this time.",
  "Fully covered and the Fog has pulled back to the pier. The Collectors are standing in a very small puddle of purple.":
    "You are fully covered and the Fog has pulled back to the pier, leaving the Collectors standing in a very small puddle of purple.",
  "That is diversification in one sentence. Different stalls, different jars, different Glimmers. When one dips, the others carry you.":
    "That is diversification in a single sentence: different stalls, different jars and different Glimmers, so that when one of them dips, the others carry you through.",
  "'I personally know' is not a plan, Baron. It is a tell.":
    "'I personally know' is not a plan, Baron. It is a tell, and a rather familiar one.",
  "Three kinds of stall beat three of the same. The West Meadow and the East Shore are not just land — they are different baskets.":
    "Three different kinds of stall will always beat three of the same. The West Meadow and the East Shore are not just extra land, they are different baskets for your eggs.",
  "One trade dipped, two others hummed, the season balanced. Spread is the quietest kind of safety.":
    "One trade dipped while two others hummed along, and the season balanced itself out. Spreading your risk is the quietest kind of safety there is.",
  "Too many eggs in one stall this season, and the dip found them. Open a different trade before you add a third of the same.":
    "You had too many eggs in one stall this season, and the dip found every one of them. I would open a different trade before adding a third of the same kind.",
  "Every zone trading, every jar working, and the dip barely left a mark. The island has become a very hard thing to knock over.":
    "Every zone is trading, every jar is working, and the dip barely left a mark. This island has become a very hard thing to knock over.",
  "Pip. One more season of saving buys the Far Point outright. Borrowing buys it today — and then you pay for it every season after.":
    "Pip, one more season of saving buys the Far Point outright. Borrowing would buy it today, but then you would keep paying for it every season afterwards.",
  "Treat them well. Want it, price it, save for it, buy it twice as happily.":
    "Treat your wants well: decide you want it, price it, save for it, and then buy it twice as happily.",
  "Waiting is not doing nothing. Every day you wait, Save and Invest are doing the work for you.":
    "Waiting is not the same as doing nothing, because every day you wait, Save and Invest are quietly doing the work for you.",
  "Patience on the ledger looks like a boring season followed by a wonderful one. You are halfway to wonderful.":
    "On a ledger, patience looks like one boring season followed by a wonderful one, and you are now halfway to wonderful.",
  "Something got bought early with borrowed Spark, and the Fog thanked you for it. Next season, let the want wait.":
    "Something was bought early with borrowed Spark, and the Fog thanked you for it. Next season, I suggest we let the want wait.",
  "Not one coin borrowed, the Far Point funded in full, and the Fog has nothing left to feed on. One season to go.":
    "Not a single coin borrowed, the Far Point funded in full, and the Fog has nothing left to feed on. There is just one season to go.",
  "Ten seasons ago the goal was a sentence: 'relight the Lighthouse'. Then we priced it, split it into seasons, and hit the targets one by one.":
    "Ten seasons ago the goal was a single sentence: relight the Lighthouse. Then we priced it, split it into seasons, and hit the targets one by one.",
  "The Fog is a debt, Baron. And debts, once paid, go very quiet.":
    "The Fog is a debt, Baron, and debts tend to go very quiet once they have been paid.",
  "Final stretch. Protect full, debt at zero, every jar doing its job. Walk to the Far Point when the Fog lifts.":
    "This is the final stretch, with Protect full, debt at zero and every jar doing its job. Walk to the Far Point as soon as the Fog lifts.",
  "Ten ledgers, ten lessons, one plan with a deadline. Look up, Pip.":
    "Ten ledgers, ten lessons, and one plan with a deadline that you actually kept. Look up, Pip.",
  "The last season wobbled, but the plan held. A goal does not need a perfect final step — it needs a final step.":
    "The last season wobbled a little, but the plan held. A goal does not need a perfect final step, it only needs a final step.",
  "A perfect final ledger. Your grandmother's books never looked this good, and I say that as the owl who kept them.":
    "That is a perfect final ledger. Your grandmother's books never looked this good, and I say that as the owl who kept them.",
  "The asterisk, Pip. It is always the asterisk.":
    "It was the asterisk, Pip. It is always the asterisk.",
  "Nobody guarantees growth, Pip. Anyone who does is selling something else — and the something else was you.":
    "Nobody can guarantee growth, Pip. Anyone who claims to is selling something else entirely, and in this case the something else was you.",
  "Guaranteed returns do not exist. Good instinct.":
    "Guaranteed returns do not exist, so that was a very good instinct.",
  "Urgency plus a prize you cannot inspect. If you must act NOW, the deal is built for you not to think.":
    "Urgency combined with a prize you cannot inspect is a classic pairing. If you must act right now, the deal has been built so that you do not have time to think.",
  "No written terms, no claims process. Real insurance names exactly what it covers and how to claim. The Protect jar does.":
    "There were no written terms and no claims process. Real insurance names exactly what it covers and how to claim, which is exactly what the Protect jar does.",
  "A policy with no terms is a fee with a hat on. Well refused.":
    "A policy with no terms is just a fee wearing a hat, so that was well refused.",
  "A fake 'normal' price makes a bad price look like a gift. The Tool Smith's level-2 upgrade is 90.":
    "A fake 'normal' price makes a bad price look like a gift. For the record, the Tool Smith's level-2 upgrade costs 90.",
  "'I personally know' is not a plan. Insider tips from strangers are the oldest Too-Good Deal on the sea.":
    "'I personally know' is not a plan, and insider tips from strangers are the oldest Too-Good Deal on the sea.",
  "Spread, don't flip. Well said.":
    "Spread your Spark rather than flipping it. That was well said.",
  "Spark Storm over the stalls! If Protect is full, this is a bill. If not — brace.":
    "There is a Spark Storm over the stalls. If Protect is full, this is only a bill; if it is not, brace yourself.",
  "A windfall is a test, not a reward. Jar it before you spend it.":
    "A windfall is a test rather than a reward, so put it in a jar before you spend any of it.",
  "Spark Dip — Invest wobbled down. This is why Invest is one jar of four, not four of four.":
    "That was a Spark Dip, and Invest wobbled downwards. This is exactly why Invest is one jar out of four rather than all four.",
  "Spark Boom! Invest jumped. Enjoy it, and remember it wobbles both ways.":
    "A Spark Boom has sent Invest jumping upwards. Enjoy it, but remember that it wobbles in both directions.",
  "A need, not a want. Protect covers this.":
    "That is a need, not a want, and Protect will cover it.",
  "Bad interest wearing a hat.":
    "That is bad interest wearing a hat.",
  "Helper Appreciation Day. Upkeep is a need — and so is saying thank you.":
    "It is Helper Appreciation Day. Upkeep is a need, and so is saying thank you to the people who earn it.",
  "It remembers. Keep going.":
    "It remembers you. Keep going.",
  "A debt fully paid goes quiet, Baron. Perhaps try saving. Five percent, every season. It compounds — I hear that's your favourite word.":
    "A debt that is fully paid goes quiet, Baron. Perhaps you should try saving instead: five percent every season, and it compounds, which I hear is your favourite word.",
  "Ten seasons. Ten lessons. One plan with a deadline. Light it up, Channeler.":
    "Ten seasons, ten lessons, and one plan with a deadline. Go and light it up, Channeler.",
  "The story ends here, but a market never does. Endless mode is open: no Baron, no deadline, just the island and your jars.":
    "The story ends here, but a market never really does. Endless mode is now open, with no Baron and no deadline, just the island and your jars.",
  "Every ledger you wrote is still in the books, Pip. The island remembers lessons even when the Fog wins.":
    "Every ledger you wrote is still in the books, Pip, and the island remembers its lessons even when the Fog wins.",
};
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;
for (const [a, b] of Object.entries(MAP)) {
  const needle = JSON.stringify(a), repl = JSON.stringify(b);
  if (src.includes(needle)) { src = src.split(needle).join(repl); n++; }
}
JSON.parse(src);
fs.writeFileSync(FILE, src);
console.log(`owl lines rewritten: ${n} / ${Object.keys(MAP).length}`);
