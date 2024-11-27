// Learn more at developers.reddit.com/docs
import { Devvit, useState, useForm, useAsync, SettingScope } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true,
});

Devvit.addSettings([
  {
    type: 'number',
    name: 'default-upvotes',
    label: 'Default $UPVs that users have at first',
    scope: SettingScope.App, // this can be a string literal 'app' as well
    onValidate: (event) => {
      if (event.value! < 0) { return 'Users should have more than 0 $UPV.' }
      if (event.value! > 1000000) { return 'Users should have less than 1,000,000 $UPV.' }
    }
  },
  {
    name: 'reddit-api-name',
    label: 'Reddit API name',
    type: 'string',
    isSecret: true,
    scope: 'app',
  },
  {
    name: 'reddit-api-key',
    label: 'Reddit API key',
    type: 'string',
    isSecret: true,
    scope: 'app',
  },
]);

// Add a menu item to the subreddit menu for instantiating the new experience post
Devvit.addMenuItem({
  label: 'New Investment Game',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();
    await reddit.submitPost({
      title: 'Invest your Subreddit!',
      subredditName: subreddit.name,
      // The preview appears while the post loads
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">Loading ...</text>
        </vstack>
      ),
    });
    ui.showToast({ text: 'Created post!' });
  },
});

async function setInitialUserPoints(context: Devvit.Context, username: string) {
  const defaultUpvotes = await context.settings.get('default-upvotes');
  await context.redis.set(`upv_${username}`, String(defaultUpvotes));
}

async function updateUserPoints(context: Devvit.Context, username: string, change: number) {
  const key = `upv_${username}`;
  const updatedPoints = await context.redis.incrBy(key, change);
  console.log(`Updated points for ${username}: ${updatedPoints}`);
  return updatedPoints;
}

async function getUserPoints(context: Devvit.Context, username: string) {
  const points = await context.redis.get(`upv_${username}`);
  return points ? parseInt(points, 10) : null;
}

async function getSubredditThemeColor(context: Devvit.Context, subredditName: string) {
  const subredditInfo = await context.reddit.getSubredditInfoByName(subredditName);

  if (!subredditInfo.id) {
    console.error('Could not retrieve subreddit ID');
    return null;
  }

  const subredditStyles = await context.reddit.getSubredditStyles(subredditInfo.id);

  return subredditStyles.primaryColor || null;
}

function getDigitedString(string: String){
  const result = string.replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
  return result;
}

Devvit.addCustomPostType({
  name: 'Subreddit Info',
  render: (context) => {
    const [subscribers, setSubscribers] = useState('');
    const [subreddit, setSubreddit] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [themeColor, setThemeColor] = useState('');
    const [liveUsers, setLiveUsers] = useState(-1);
    const {
      data: username,
      loading: usernameLoading,
      error: usernameError,
    } = useAsync(async () => {
      const currUser = await context.reddit.getCurrentUser();
      return currUser?.username ?? 'Anonymous';
    });

    var userPoints = useAsync(async () => {
      console.log(getUserPoints(context, username!));
      return await getUserPoints(context, username!);
    });

    const subredditForm = useForm({
      title: 'Select a Subreddit',
      description: 'Enter the name of the subreddit you want to invest.',
      fields: [
        { name: 'subreddit', label: 'Subreddit Name', type: 'string' }
      ]
    }, async (formValues) => {
      try {
        setSubreddit(String(formValues.subreddit));
        const subscribers = await context.reddit.getSubredditInfoByName(String(formValues.subreddit));
        setSubscribers(String(subscribers.subscribersCount));
        setLiveUsers(subscribers.activeCount!);
        setIsLoading(false);
        const themeColor = await getSubredditThemeColor(context, String(formValues.subreddit));
        setThemeColor(themeColor!);
      } catch (error) {
        console.error(error);
        context.ui.showToast({ text: `${error}` });
      }
    });

    return (
      <zstack height="100%" width="100%" alignment="middle center">
        <vstack gap="medium" padding="small" alignment="middle center">
          <image url="https://www.redditstatic.com/devvit-dev-portal/assets/landing-page/flyingSnoo.png" imageWidth="100px" imageHeight="100px"></image>
          <button icon="search-fill" onPress={() => context.ui.showForm(subredditForm)}>
            Find What To Invest
          </button>
          {subreddit !== '' && <text size="xlarge" weight="bold" color={themeColor}>r/{subreddit}</text>}
          {subscribers ? (
            <hstack gap="medium"><hstack gap="small"><icon name="users-fill" color="#2F54D2"></icon><text weight="bold" color="#2F54D2">MEMBERS</text></hstack><text weight="bold">{getDigitedString(String(subscribers))}</text></hstack>
          ) : <text>Discover and choose which subreddit to invest.</text>}
          {liveUsers >= 0 && <hstack gap="medium"><hstack gap="small"><icon name="live-fill" color="green"></icon><text weight="bold" color="green">LIVE</text></hstack><text weight="bold">{getDigitedString(String(liveUsers))}</text></hstack>}
          {isLoading && <icon name="load"></icon>}
        </vstack>
        <hstack height="100%" width="100%" alignment="top end" padding="small">
          <vstack>
            <text size="small" color="gray">u/{username}</text>
            <text size="small" color="gray">$UPV</text>
          </vstack>
        </hstack>
      </zstack>
    );
  },
});

export default Devvit;
