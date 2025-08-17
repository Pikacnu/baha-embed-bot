import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageFlags,
  AttachmentBuilder,
  ComponentType,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  ApplicationCommand,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentBuilder,
  TextDisplayBuilder,
} from 'discord.js';

import {
  createCanvas,
  Image,
  GlobalFonts,
  loadImage,
  type CanvasRenderingContext2D,
} from '@napi-rs/canvas';

import { createComponentByPostData, fetchData } from './api/baha';
import { splitComponentsByLength } from './api/component-generator';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const commands: Array<
  [
    string,
    SlashCommandBuilder | ContextMenuCommandBuilder,
    ({
      interaction,
    }: {
      interaction: MessageContextMenuCommandInteraction;
    }) => Promise<{
      messageURL?: string;
    } | void>,
  ]
> = [
  [
    'createEmbed',
    new ContextMenuCommandBuilder()
      .setName('createEmbed')
      .setType(ApplicationCommandType.Message)
      .setNameLocalizations({
        'zh-TW': '創建嵌入',
        'en-US': 'Create Embed',
      }),
    async ({ interaction }) => {
      const targetMessage = interaction.targetMessage;
      if (!targetMessage) return;
      const URLRegex =
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
      const match = targetMessage.content.match(URLRegex);
      if (!match) {
        await interaction.reply({
          content: 'Invalid URL.',
          ephemeral: true,
        });
        return;
      }
      const url = match[0];
      if (!url) {
        await interaction.reply({
          content: 'Invalid URL.',
          ephemeral: true,
        });
        return;
      }
      let result;
      try {
        result = await fetchData({
          url,
          //session: interaction.session,
        });
      } catch (error) {
        console.error('Error fetching data:', error);
        await interaction.reply({
          content: 'Failed to fetch data.',
          ephemeral: true,
        });
        return;
      }
      if (!result) {
        await interaction.reply({
          content: 'Failed to fetch data.',
          ephemeral: true,
        });
        return;
      }
      let components = createComponentByPostData(result.postData!);
      const componentGroups = splitComponentsByLength(components);

      if (componentGroups.length > 0) {
        for (const group of componentGroups) {
          const customId = `embed-${interaction.user.id}-${Date.now()}`;
          const deleteButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(customId)
              .setLabel('Delete')
              .setStyle(ButtonStyle.Danger),
          );
          await interaction.followUp({
            components: [
              ...group.map((c) => c.toJSON()),
              deleteButton.toJSON(),
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }
        return;
      }
      const customId = `embed-${interaction.user.id}-${Date.now()}`;
      const deleteButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(customId)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger),
      );

      if (components.length > 39) {
        components = [
          ...components.slice(0, 38),
          new TextDisplayBuilder().setContent(
            '內容過長，無法完整顯示 [原始連結](' + url + ')',
          ),
        ];
      }

      try {
        await interaction.reply({
          components: [
            ...components.map((c) => c.toJSON()),
            deleteButton.toJSON(),
          ],
          flags: /*MessageFlags.Ephemeral +*/ MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        console.error('Failed to send full message:', error);
        try {
          await interaction.reply({
            content: `❌ **內容過長，無法完整顯示**\n\n**標題：** ${
              result.postData?.content?.[0]?.header?.title || '未知標題'
            }\n\n請直接訪問原始連結查看完整內容：\n${url}`,
            ephemeral: true,
          });
        } catch (fallbackError) {
          console.error('Failed to send fallback message:', fallbackError);
          await interaction.reply({
            content: '❌ 處理此連結時發生錯誤，請稍後再試。',
            ephemeral: true,
          });
        }
      }
    },
  ],
  /*
  [
    'combineCurrentMessageImages',
    new ContextMenuCommandBuilder()
      .setName('combineCurrentMessageImages')
      .setType(ApplicationCommandType.Message)
      .setNameLocalizations({
        'zh-TW': '合併當前訊息圖片',
        'en-US': "Combine Current Message's Images",
      }),
    async ({ interaction }) => {
      const targetMessage = interaction.targetMessage;
      const imageUrls = [
        ...targetMessage.attachments.map((attachment) => attachment.url),
        ...targetMessage.components
          .filter((component) => component.type === ComponentType.MediaGallery)
          .flatMap((component) =>
            component.items.map((item) => item.media.url),
          ),
      ];

      if (imageUrls.length <= 1) {
        await interaction.reply({
          content: 'Not enough images to combine. (2 required)',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        content: `Generating combined image...`,
        flags: MessageFlags.Ephemeral,
      });
      //assets set up
      const urlImageEntries: [string, Image][] = await Promise.all(
        imageUrls.map(async (url) => [
          url,
          await loadImage(url).then((img) => img as Image),
        ]),
      );
      let singleImageMaxWidth = 0;
      let singleImageMaxHeight = 0;
      urlImageEntries.forEach(([_, img]) => {
        if (img.width > singleImageMaxWidth) singleImageMaxWidth = img.width;
        if (img.height > singleImageMaxHeight)
          singleImageMaxHeight = img.height;
      });
      const gridSize = Math.ceil(Math.sqrt(urlImageEntries.length));
      const gridLike = Array.from({ length: gridSize }, (_, colIndex) =>
        Array.from(
          { length: gridSize },
          (_, rowIndex) =>
            colIndex * gridSize + rowIndex < urlImageEntries.length,
        ).filter(Boolean),
      ).filter((row) => row.length > 0);

      const maxWidth = singleImageMaxWidth * gridLike.length;
      const maxHeight = singleImageMaxHeight * (gridLike[0]?.length ?? 0);
      const urlImageMap: Record<string, Image> =
        Object.fromEntries(urlImageEntries);
      const canvas = createCanvas(maxWidth, maxHeight);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, maxWidth, maxHeight);
      let xOffset = 0;
      let yOffset = 0;
      for (const [, img] of Object.entries(urlImageMap)) {
        const currentImageWidth = img.width;
        const currentImageHeight = img.height;
        ctx.drawImage(
          img,
          xOffset + (singleImageMaxWidth - currentImageWidth) / 2,
          yOffset + (singleImageMaxHeight - currentImageHeight) / 2,
          currentImageWidth,
          currentImageHeight,
        );
        xOffset += singleImageMaxWidth;
        if (xOffset >= maxWidth) {
          xOffset = 0;
          yOffset += singleImageMaxHeight;
        }
      }
      const combinedImage = canvas.toBuffer('image/webp');
      const attachment = new AttachmentBuilder(combinedImage, {
        name: 'combined_image.webp',
      });
      const combinedMessage = await interaction.user.send({
        files: [attachment],
      });
      await interaction.editReply({
        content: `Combined image sent: ${combinedMessage.url}`,
      });
    },
  ],*/
];

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      const buttonId = interaction.customId;
      // handle delete button for generated embeds
      if (typeof buttonId === 'string' && buttonId.startsWith('embed-')) {
        // customId format: embed-<ownerId>-<timestamp>
        const parts = buttonId.split('-');
        const ownerId = parts[1];
        // only the creator can delete
        if (interaction.user.id !== ownerId) {
          try {
            await interaction.reply({
              content: '只有建立者可以刪除。',
              ephemeral: true,
            });
          } catch (err) {
            // best effort
            console.error('Failed to send permission reply:', err);
          }
          return;
        }

        try {
          // acknowledge the interaction quickly
          await interaction.deferUpdate();

          // try to delete the message that contained the button
          const msg = interaction.message;
          if (msg && (msg as any).channel) {
            // If the channel is cached, delete the message directly
            await (msg as any).delete();
          } else {
            // For ephemeral replies or when channel isn't cached, try safer alternatives
            try {
              if (typeof interaction.deleteReply === 'function') {
                // Deletes the original reply (works for ephemeral/normal replies when possible)
                // @ts-ignore
                await interaction.deleteReply();
              } else if (typeof interaction.editReply === 'function') {
                // Remove components / mark deleted
                // @ts-ignore
                await interaction.editReply({
                  content: '已刪除',
                  components: [],
                });
              } else {
                // final fallback: notify user
                await interaction.followUp({
                  content: '已刪除 (fallback)',
                  ephemeral: true,
                });
              }
            } catch (e) {
              // best-effort fallback: notify user
              try {
                await interaction.followUp({
                  content: '已刪除 (fallback)',
                  ephemeral: true,
                });
              } catch {}
            }
          }
        } catch (err) {
          console.error('刪除訊息失敗：', err);
          try {
            await interaction.followUp({
              content: '刪除失敗。',
              ephemeral: true,
            });
          } catch {}
        }

        return;
      }
    }

    if (interaction.isMessageContextMenuCommand()) {
      const commandName = interaction.commandName;
      const fn = commands.find(([name]) => name === commandName)?.[2];
      if (fn) {
        const result = await fn({
          interaction,
        });
        if (result) {
          const { messageURL } = result;
          if (messageURL) {
            await interaction.reply({
              content: `${messageURL}`,
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      } else {
        await interaction.reply({
          content: 'Unknown command.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

const rest = new REST().setToken(process.env.CLIENT_TOKEN || '');

await rest.put(Routes.applicationCommands(process.env.CLIENT_ID || ''), {
  body: commands.slice(0, 5).map((command) => command[1].toJSON()),
});

await client.login(process.env.CLIENT_TOKEN || '');

async function exitHandler() {
  await client.destroy();
}

process.on('SIGINT', async () => {
  await exitHandler();
  process.exit(0);
});

process.on('beforeExit', async () => {
  await exitHandler();
});
