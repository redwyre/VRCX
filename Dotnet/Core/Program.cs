using NLog;
using NLog.Targets;
using System;
using System.Data.SQLite;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Text.Json;
using System.Threading;
//#if !LINUX
//using System.Windows.Forms;
//using VRCX.Overlay;
//#endif

namespace VRCX
{
    public static class Program
    {
        public static string BaseDirectory { get; private set; }
        public static string AppDataDirectory;
        public static string ConfigLocation { get; private set; }
        public static string Version { get; private set; }
        public static bool LaunchDebug;
        private static readonly Logger logger = LogManager.GetCurrentClassLogger();
        public static AppApi AppApiInstance { get; private set; }

        public static void SetAppApiInstance(AppApi appApiInstance) => AppApiInstance = appApiInstance;
        public static void SetVersion(string version) => Version = version;
        

        private static void SetProgramDirectories()
        {
            if (string.IsNullOrEmpty(AppDataDirectory))
                AppDataDirectory = Path.Join(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "VRCX");

            BaseDirectory = AppDomain.CurrentDomain.BaseDirectory;
            ConfigLocation = Path.Join(AppDataDirectory, "VRCX.sqlite3");

            if (!Directory.Exists(AppDataDirectory))
            {
                Directory.CreateDirectory(AppDataDirectory);

                // Migrate config to AppData
                if (File.Exists(Path.Join(BaseDirectory, "VRCX.json")))
                {
                    File.Move(Path.Join(BaseDirectory, "VRCX.json"), Path.Join(AppDataDirectory, "VRCX.json"));
                    File.Copy(Path.Join(AppDataDirectory, "VRCX.json"),
                        Path.Join(AppDataDirectory, "VRCX-backup.json"));
                }

                if (File.Exists(Path.Join(BaseDirectory, "VRCX.sqlite3")))
                {
                    File.Move(Path.Join(BaseDirectory, "VRCX.sqlite3"),
                        Path.Join(AppDataDirectory, "VRCX.sqlite3"));
                    File.Copy(Path.Join(AppDataDirectory, "VRCX.sqlite3"),
                        Path.Join(AppDataDirectory, "VRCX-backup.sqlite3"));
                }
            }

            // Migrate cache to userdata for Cef 115 update
            var oldCachePath = Path.Join(AppDataDirectory, "cache");
            var newCachePath = Path.Join(AppDataDirectory, "userdata", "cache");
            if (Directory.Exists(oldCachePath) && !Directory.Exists(newCachePath))
            {
                Directory.CreateDirectory(Path.Join(AppDataDirectory, "userdata"));
                Directory.Move(oldCachePath, newCachePath);
            }
        }

        public static void GetVersion()
        {
            try
            {
                var versionFile = File.ReadAllText(Path.Join(BaseDirectory, "Version")).Trim();

                // look for trailing git hash "-22bcd96" to indicate nightly build
                var version = versionFile.Split('-');
                if (version.Length > 0 && version[^1].Length == 7)
                    Version = $"VRCX Nightly {versionFile}";
                else
                    Version = $"VRCX {versionFile}";
            }
            catch (Exception ex)
            {
                logger.Error(ex, "Failed to read version file");
                Version = "VRCX Nightly Build";
            }
        }

        private static void ConfigureLogger()
        {
            var fileName = Path.Join(AppDataDirectory, "logs", "VRCX.log");
            if (StartupArgs.LaunchArguments.IsOverlay)
                fileName = Path.Join(AppDataDirectory, "logs", "VRCX.Overlay.log");

            LogManager.Setup().LoadConfiguration(builder =>
            {
                var fileTarget = new FileTarget("fileTarget")
                {
                    FileName = fileName,
                    //Layout = "${longdate} [${level:uppercase=true}] ${logger} - ${message} ${exception:format=tostring}",
                    // Layout with padding between the level/logger and message so that the message always starts at the same column
                    Layout =
                        "${longdate} [${level:uppercase=true:padding=-5}] ${logger:padding=-20} - ${message} ${exception:format=tostring}",
                    ArchiveSuffixFormat = "{0:000}",
                    ArchiveEvery = FileArchivePeriod.Day,
                    MaxArchiveFiles = 4,
                    MaxArchiveDays = 7,
                    ArchiveAboveSize = 10000000,
                    ArchiveOldFileOnStartup = true,
                    KeepFileOpen = true,
                    AutoFlush = true,
                    Encoding = System.Text.Encoding.UTF8
                };
                builder.ForLogger().FilterMinLevel(LogLevel.Debug).WriteTo(fileTarget);

                var consoleTarget = new ConsoleTarget("consoleTarget")
                {
                    Layout = "${longdate} [${level:uppercase=true:padding=-5}] ${logger:padding=-20} - ${message} ${exception:format=tostring}",
                    DetectConsoleAvailable = true
                };
                builder.ForLogger().FilterMinLevel(LogLevel.Debug).WriteTo(consoleTarget);
            });
        }

#if !LINUX
#else
        public static VRCXVRInterface VRCXVRInstance;
        
        public static void PreInit(string version, string[] args)
        {
            Version = version;
            StartupArgs.ArgsCheck(args);
            SetProgramDirectories();
        }

        public static void Init()
        {
            ConfigureLogger();
            Update.Check();

            logger.Info("{0} Starting...", Version);
            logger.Info("Args: {0}", JsonSerializer.Serialize(StartupArgs.Args));
            if (!string.IsNullOrEmpty(StartupArgs.LaunchArguments.LaunchCommand))
                logger.Info("Launch Command: {0}", StartupArgs.LaunchArguments.LaunchCommand);

            AppApiInstance = new AppApiElectron();
            
            VRCXVRInstance = new VRCXVRElectron();
            VRCXVRInstance.Init();
        }
#endif
    }

#if LINUX
    public class ProgramElectron
    {
        public void PreInit(string version, string[] args)
        {
            Program.PreInit(version, args);
        }

        public void Init()
        {
            Program.Init();
        }
    }
#endif
}
