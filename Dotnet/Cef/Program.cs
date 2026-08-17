using NLog;
using NLog.Targets;
using System;
using System.Data.SQLite;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Windows.Forms;
using VRCX.Overlay;

namespace VRCX
{
    public static class ProgramCef
    {
        private static readonly Logger logger = LogManager.GetCurrentClassLogger();

        public static string BaseDirectory
        {
            get; private set;
        }

        public static string AppDataDirectory;

        public static string ConfigLocation
        {
            get; private set;
        }

        public static string Version => Program.Version;

        public static AppApi AppApiInstance
        {
            get => Program.AppApiInstance;
            private set => Program.SetAppApiInstance(value);
        }

        [STAThread]
        [SuppressMessage("Interoperability", "CA1416:Validate platform compatibility")]
        private static void Main()
        {
            BrowserSubprocess.Start();
            if (Wine.GetIfWine())
            {
                MessageBox.Show(
                    "VRCX Cef has detected Wine.\nPlease switch to our native Electron build for Linux.",
                    "Wine Detected", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            try
            {
                Run();
            }

            #region Handle CEF Explosion

            catch (FileNotFoundException e)
            {
                logger.Error(e, "Handled Exception, Missing file found in Handle Cef Explosion.");

                var result = MessageBox.Show(
                    "VRCX has encountered an error with the CefSharp backend,\nthis is typically caused by missing files or dependencies.\nWould you like to try autofix by automatically installing vc_redist?.",
                    "VRCX CefSharp not found.", MessageBoxButtons.YesNo, MessageBoxIcon.Error);
                switch (result)
                {
                case DialogResult.Yes:
                    logger.Fatal("Handled Exception, user selected auto install of vc_redist.");
                    Update.DownloadInstallRedist().GetAwaiter().GetResult();
                    MessageBox.Show(
                        "vc_redist has finished installing, if the issue persists upon next restart, please reinstall VRCX From GitHub,\nVRCX Will now restart.",
                        "vc_redist installation complete", MessageBoxButtons.OK);
                    Thread.Sleep(5000);
                    AppApiInstance.RestartApplication(false);
                    break;

                case DialogResult.No:
                    logger.Fatal("Handled Exception, user chose manual.");
                    MessageBox.Show(
                        "VRCX will now close, try reinstalling VRCX using the setup from Github as a potential fix.",
                        "VRCX CefSharp not found", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    Thread.Sleep(5000);
                    Environment.Exit(0);
                    break;
                }
            }

            #endregion

            #region Handle Database Error

            catch (SQLiteException e)
            {
                logger.Fatal(e, "Unhandled SQLite Exception, closing.");
                var messageBoxResult = MessageBox.Show(
                    "A fatal database error has occured.\n" +
                    "Please try to repair your database by following the steps in the provided repair guide, or alternatively rename your \"%AppData%\\VRCX\" folder to reset VRCX. " +
                    "If the issue still persists after following the repair guide please join the Discord (https://vrcx.app/discord) for further assistance. " +
                    "Would you like to open the webpage for database repair steps?\n" +
                    e, "Database error", MessageBoxButtons.YesNo, MessageBoxIcon.Error);
                if (messageBoxResult == DialogResult.Yes)
                {
                    AppApiInstance.OpenLink("https://github.com/vrcx-team/VRCX/wiki#how-to-repair-vrcx-database");
                }
            }

            #endregion

            catch (Exception e)
            {
                var cpuError = WinApi.GetCpuErrorMessage();
                if (cpuError != null)
                {
                    var messageBoxResult = MessageBox.Show(cpuError.Value.message, "Potentially Faulty CPU Detected",
                        MessageBoxButtons.YesNo, MessageBoxIcon.Error);
                    if (messageBoxResult == DialogResult.Yes)
                    {
                        AppApiInstance.OpenLink(cpuError.Value.link);
                    }
                }

                logger.Fatal(e, "Unhandled Exception, program dying");
                var result = MessageBox.Show(e.ToString(), $"{Version} crashed, open Discord for support?", MessageBoxButtons.YesNo, MessageBoxIcon.Error);
                if (result == DialogResult.Yes)
                {
                    AppApiInstance.OpenLink("https://vrcx.app/discord");
                }
                Environment.Exit(0);
            }
        }

        [SuppressMessage("Interoperability", "CA1416:Validate platform compatibility")]
        private static void Run()
        {
            var args = Environment.GetCommandLineArgs();
            StartupArgs.ArgsCheck(args);
            SetProgramDirectories();
            VRCXStorage.Instance.Load();
            ConfigureLogger();
            Program.GetVersion();
            if (StartupArgs.LaunchArguments.IsOverlay)
                OverlayProgram.OverlayMain();

            Update.Check();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            logger.Info("{0} Starting...", Version);
            logger.Info("Args: {0}", JsonSerializer.Serialize(StartupArgs.Args));
            if (!string.IsNullOrEmpty(StartupArgs.LaunchArguments.LaunchCommand))
                logger.Info("Launch Command: {0}", StartupArgs.LaunchArguments.LaunchCommand);
            logger.Debug("Wine detection: {0}", Wine.GetIfWine());

            IPCServer.Instance.Init();
            SQLite.Instance.Init();
            AppApiInstance = new AppApiCef();

            ProcessMonitor.Instance.Init();
            Discord.Instance.Init();
            WebApi.Instance.Init();
            LogWatcher.Instance.Init();
            AutoAppLaunchManager.Instance.Init();
            CefService.Instance.Init();
            OverlayServer.Instance.Init();

            Application.Run(new MainForm());

            logger.Info("{0} Exiting...", Version);
            WebApi.Instance.SaveCookies();
            OverlayServer.Instance.Exit();
            CefService.Instance.Exit();
            AutoAppLaunchManager.Instance.Exit();
            LogWatcher.Instance.Exit();
            WebApi.Instance.Exit();
            Discord.Instance.Exit();
            VRCXStorage.Instance.Save();
            SQLite.Instance.Exit();
            ProcessMonitor.Instance.Exit();
        }
    }
}
