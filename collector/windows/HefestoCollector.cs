using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Diagnostics.Eventing.Reader;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Management;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Xml;
using Microsoft.Win32;

namespace HefestoCollector {
  public class Config { public string server; public string id; public string protectedToken; public string startedAt; }
  public class Cursor { public long recordId; public string warning; }
  public class PrintEvent { public string eventKey; public string occurredAt; public string username; public string clientHostname; public string printerName; public string port; public int? pages; public string jobId; }
  public class PrinterQueue { public string key; public string name; public string driver; public string port; public string connection; public string deviceId; }
  public class Health { public bool logEnabled; public bool inventoryOk; public int backlog; public string warning; }
  public class Batch { public int protocol=1; public List<PrintEvent> events=new List<PrintEvent>(); public List<PrinterQueue> queues; public Health health=new Health(); }

  internal static class Program {
    public const string Version="0.1.0-pilot", ServiceName="HefestoWorkstationCollector", Channel="Microsoft-Windows-PrintService/Operational";
    public static readonly string Root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"Hefesto","Collector");
    public static readonly string InstallDir=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Hefesto","Collector");
    public static readonly string InstalledExe=Path.Combine(InstallDir,"HefestoCollector.exe");
    public static JavaScriptSerializer Json() { return new JavaScriptSerializer { MaxJsonLength=1024*1024 }; }
    [STAThread] static int Main(string[] args) {
      try {
        if(args.Length==2 && args[0]=="--self-test") { SelfTest.Run(args[1]); return 0; }
        if(args.Length==3 && args[0]=="--transport-test") { SelfTest.Transport(args[1],args[2]); return 0; }
        if(args.Length==2 && args[0]=="--diagnose") { AtomicWrite(args[1],Json().Serialize(new { hostname=Environment.MachineName,version=Version,queues=Inventory.Read(),inkLevel=(int?)null,physicalCounter=(long?)null })); return 0; }
        if(args.Length==1 && args[0]=="--service") { ServiceBase.Run(new CollectorService()); return 0; }
        if(!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator)) {
          Process.Start(new ProcessStartInfo(Assembly.GetExecutingAssembly().Location,args.Length==1&&args[0]=="--uninstall"?"--uninstall":"") { UseShellExecute=true,Verb="runas" });return 0;
        }
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        if(args.Length==1 && args[0]=="--uninstall") {
          if(MessageBox.Show("Remover o serviço do coletor? O histórico e os registros locais serão mantidos.","Hefesto",MessageBoxButtons.YesNo)!=DialogResult.Yes)return 0;
          ServiceControl.Remove();Registry.LocalMachine.DeleteSubKeyTree(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\HefestoCollector",false);
          MessageBox.Show("Serviço removido. O histórico permanece no Hefesto e os arquivos locais em ProgramData\\Hefesto\\Collector.","Hefesto");return 0;
        }
        Application.Run(new InstallerForm());return 0;
      } catch(Exception error) {
        if(args.Length==3 && args[0]=="--transport-test") { AtomicWrite(args[2],Json().Serialize(new { success=false,error=error.Message }));return 1; }
        if(args.Length==2 && (args[0]=="--self-test"||args[0]=="--diagnose")) { AtomicWrite(args[1],Json().Serialize(new { success=false,error=error.Message }));return 1; }
        if(args.Length==1&&args[0]=="--service")return 1;
        MessageBox.Show(error.Message,"Hefesto — não foi possível concluir",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;
      }
    }
    public static string Clean(object value,int length) {
      string s=Convert.ToString(value,CultureInfo.InvariantCulture);if(String.IsNullOrWhiteSpace(s))return null;
      s=new string(s.Where(c=>!Char.IsControl(c)).ToArray());return s.Length>length?s.Substring(0,length):s;
    }
    public static string Hash(string value) { using(var hash=SHA256.Create())return BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-","").ToLowerInvariant(); }
    public static void AtomicWrite(string path,string content) {
      string temp=path+".tmp";File.WriteAllText(temp,content,new UTF8Encoding(false));
      if(File.Exists(path))File.Replace(temp,path,null);else File.Move(temp,path);
    }
    public static void SecureDirectory(string path,bool publicRead=false) {
      Directory.CreateDirectory(path);var acl=new DirectorySecurity();acl.SetAccessRuleProtection(true,false);
      foreach(var sid in new[]{WellKnownSidType.LocalSystemSid,WellKnownSidType.BuiltinAdministratorsSid})
        acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid,null),FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
      if(publicRead)acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid,null),FileSystemRights.ReadAndExecute,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
      Directory.SetAccessControl(path,acl);
    }
    public static Uri ServerUri(string address) {
      Uri uri;if(!Uri.TryCreate(address,UriKind.Absolute,out uri)||(uri.Scheme!="http"&&uri.Scheme!="https")||uri.AbsolutePath!="/"||uri.UserInfo!=""||uri.Query!=""||uri.Fragment!="")throw new Exception("Informe somente o endereço do Hefesto, por exemplo http://192.0.2.10.");
      return uri;
    }
    public static string Post(string server,string route,object payload,string token) {
      ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
      var request=(HttpWebRequest)WebRequest.Create(new Uri(ServerUri(server),"api/workstations/"+route));
      request.Method="POST";request.ContentType="application/json; charset=utf-8";request.Timeout=15000;request.ReadWriteTimeout=15000;request.AllowAutoRedirect=false;request.Proxy=null;
      if(token!=null)request.Headers[HttpRequestHeader.Authorization]="Bearer "+token;
      byte[] bytes=Encoding.UTF8.GetBytes(Json().Serialize(payload));request.ContentLength=bytes.Length;
      using(var stream=request.GetRequestStream())stream.Write(bytes,0,bytes.Length);
      using(var response=(HttpWebResponse)request.GetResponse()) {
        if((int)response.StatusCode<200||(int)response.StatusCode>=300)throw new Exception("Resposta inesperada do servidor.");
        using(var reader=new StreamReader(response.GetResponseStream()))return reader.ReadToEnd();
      }
    }
    public static void Log(string message) {
      try { string path=Path.Combine(Root,"collector.log");if(File.Exists(path)&&new FileInfo(path).Length>256*1024)File.Move(path,path+"."+DateTime.UtcNow.ToString("yyyyMMddHHmmss"));
        File.AppendAllText(path,DateTime.UtcNow.ToString("o")+" "+message+Environment.NewLine);
        foreach(var old in Directory.GetFiles(Root,"collector.log.*").OrderByDescending(x=>x).Skip(2))File.Delete(old);
      }catch{}
    }
  }

  internal class InstallerForm : Form {
    TextBox server=new TextBox(),code=new TextBox();Button install=new Button();Label result=new Label();
    public InstallerForm() {
      Text="Hefesto — Coletor Windows (piloto)";ClientSize=new Size(620,410);StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;Font=new Font("Segoe UI",10);
      Controls.Add(new Label {Text="Computador: "+Environment.MachineName,Left=24,Top=22,Width=560,Height=24});
      Controls.Add(new Label {Text="Endereço do Hefesto",Left=24,Top=62,Width=550,Height=24});server.SetBounds(24,90,565,28);server.Text = "";Controls.Add(server);
      Controls.Add(new Label {Text="Código gerado em Ferramentas > Instalar coletor Windows",Left=24,Top=131,Width=565,Height=24});code.SetBounds(24,159,565,28);code.MaxLength=64;Controls.Add(code);
      Controls.Add(new Label {Text="Coleta hostname, filas, login, data e páginas informadas pelo Windows.\nNão coleta conteúdo ou nome dos documentos. A M1180 permanece por USB.\nTinta e contador físico ainda dependem de validação no aparelho.",Left=24,Top=206,Width=565,Height=80});
      install.Text="Instalar e iniciar";install.SetBounds(24,296,180,36);Controls.Add(install);install.Click+=async delegate(object sender,EventArgs e){
        install.Enabled=false;result.Text="Instalando...";
        try {string url=Program.ServerUri(server.Text.Trim()).AbsoluteUri,pair=code.Text.Trim();if(pair.Length!=32||pair.Any(c=>!Uri.IsHexDigit(c)))throw new Exception("Copie o código de instalação exibido no Hefesto.");
          await Task.Run(()=>Install(url,pair));code.Clear();result.Text="Instalado. Imprima uma página de teste e consulte o Hefesto.";install.Text="Instalado";
        }catch(Exception error){result.Text=error is WebException?"Falha de comunicação ou código inválido. Confira o servidor e gere um novo código.":error.Message;install.Enabled=true;}
      };result.SetBounds(24,344,565,56);Controls.Add(result);
    }
    public static void Install(string server,string code) {
      if(ServiceControl.Exists())throw new Exception("Já existe um coletor instalado. Remova-o em Aplicativos do Windows antes de reinstalar.");
      using(var log=new EventLogConfiguration(Program.Channel)) { var ignored=log.IsEnabled; }
      var enrolled=Program.Json().Deserialize<Dictionary<string,object>>(Program.Post(server,"enroll",new { code=code,hostname=Environment.MachineName,version=Program.Version },null));
      string id=Convert.ToString(enrolled["id"]),token=Convert.ToString(enrolled["token"]),started=Convert.ToString(enrolled["enrolledAt"]);
      Guid guid;if(!Guid.TryParse(id,out guid)||token.Length!=64||token.Any(c=>!Uri.IsHexDigit(c)))throw new Exception("Resposta de pareamento inválida.");
      bool logWasEnabled=true,created=false;
      try {
        Program.SecureDirectory(Program.Root);Program.SecureDirectory(Program.InstallDir,true);Directory.CreateDirectory(Path.Combine(Program.Root,"outbox"));
        // Keep any prior installation's pending records with its old identity; never attribute them to a new enrollment.
        if(File.Exists(Path.Combine(Program.Root,"config.json"))) {
          string archive=Path.Combine(Program.Root,"previous-"+DateTime.UtcNow.ToString("yyyyMMddHHmmss"));Directory.CreateDirectory(archive);
          foreach(string name in new[]{"config.json","cursor.json","outbox"}) { string source=Path.Combine(Program.Root,name);if(File.Exists(source))File.Move(source,Path.Combine(archive,name));else if(Directory.Exists(source))Directory.Move(source,Path.Combine(archive,name)); }
          Directory.CreateDirectory(Path.Combine(Program.Root,"outbox"));
        }
        if(!String.Equals(Assembly.GetExecutingAssembly().Location,Program.InstalledExe,StringComparison.OrdinalIgnoreCase))File.Copy(Assembly.GetExecutingAssembly().Location,Program.InstalledExe,true);
        var config=new Config {server=server,id=id,startedAt=started,protectedToken=Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(token),null,DataProtectionScope.LocalMachine))};
        Program.AtomicWrite(Path.Combine(Program.Root,"config.json"),Program.Json().Serialize(config));
        using(var log=new EventLogConfiguration(Program.Channel)) {logWasEnabled=log.IsEnabled;if(!logWasEnabled){log.IsEnabled=true;log.SaveChanges();}}
        ServiceControl.Create();created=true;ServiceControl.Start();
        using(var key=Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\HefestoCollector")) {
          key.SetValue("DisplayName","Hefesto — Coletor Windows (piloto)");key.SetValue("DisplayVersion",Program.Version);key.SetValue("Publisher","Hefesto");
          key.SetValue("UninstallString","\""+Program.InstalledExe+"\" --uninstall");key.SetValue("NoModify",1);key.SetValue("NoRepair",1);
        }
        Program.Log("Instalação concluída.");
      }catch{if(created)try{ServiceControl.Remove();}catch{}if(!logWasEnabled)try{using(var log=new EventLogConfiguration(Program.Channel)){log.IsEnabled=false;log.SaveChanges();}}catch{}throw;}
    }
  }

  internal static class Inventory {
    public static List<PrinterQueue> Read() {
      var ports=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      using(var search=new ManagementObjectSearcher("SELECT Name FROM Win32_TCPIPPrinterPort")) {search.Options.Timeout=TimeSpan.FromSeconds(10);foreach(ManagementObject p in search.Get())using(p)ports.Add(Convert.ToString(p["Name"]));}
      var result=new List<PrinterQueue>();
      using(var search=new ManagementObjectSearcher("SELECT Name,DriverName,PortName,PNPDeviceID,Network FROM Win32_Printer")) {
        search.Options.Timeout=TimeSpan.FromSeconds(10);
        foreach(ManagementObject p in search.Get())using(p){
          string name=Program.Clean(p["Name"],255),driver=Program.Clean(p["DriverName"],255),port=Program.Clean(p["PortName"],255),device=Program.Clean(p["PNPDeviceID"],500);
          if(name==null)continue;
          string kind=Connection(driver,port,ports.Contains(port));
          result.Add(new PrinterQueue { key=Program.Hash(name+"\n"+port),name=name,driver=driver,port=port,connection=kind,deviceId=device });
          if(result.Count>=200)break;
        }
      }
      return result;
    }
    public static string Connection(string driver,string port,bool tcp) {
      string p=(port??"").ToUpperInvariant(),d=(driver??"").ToUpperInvariant();
      if(p.StartsWith("USB"))return "usb";
      if(tcp||p.StartsWith("IP_")||p.StartsWith("WSD-"))return "tcpip";
      if(p.StartsWith(@"\\"))return "shared";
      if(p=="PORTPROMPT:"||p=="FILE:"||p=="NUL:"||d.Contains("PRINT TO PDF")||d.Contains("XPS DOCUMENT")||d.Contains("ONENOTE")||d=="FAX")return "virtual";
      return "other";
    }
  }

  internal static class PrintParser {
    public static PrintEvent Parse(string xml) {
      var doc=new XmlDocument {XmlResolver=null};
      using(var reader=XmlReader.Create(new StringReader(xml),new XmlReaderSettings {DtdProcessing=DtdProcessing.Prohibit,XmlResolver=null}))doc.Load(reader);
      var ns=new XmlNamespaceManager(doc.NameTable);ns.AddNamespace("e","http://schemas.microsoft.com/win/2004/08/events/event");
      if(doc.SelectSingleNode("/e:Event/e:System/e:EventID",ns).InnerText!="307")return null;
      if(doc.SelectSingleNode("/e:Event/e:System/e:Provider",ns).Attributes["Name"].Value!="Microsoft-Windows-PrintService")return null;
      var values=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
      foreach(XmlNode node in doc.SelectNodes("/e:Event/e:UserData//*[not(*)] | /e:Event/e:EventData/e:Data",ns)) {
        string name=node.Attributes["Name"]!=null?node.Attributes["Name"].Value:node.LocalName;
        // Document title (Param2) deliberately never enters the payload.
        if(name!="Param2")values[name]=node.InnerText;
      }
      Func<string,string> get=key=>values.ContainsKey(key)?values[key]:null;
      string printer=Program.Clean(get("Param5"),255);if(printer==null)throw new Exception("Evento de impressão incompleto.");
      string at=DateTime.Parse(doc.SelectSingleNode("/e:Event/e:System/e:TimeCreated",ns).Attributes["SystemTime"].Value,CultureInfo.InvariantCulture,DateTimeStyles.AdjustToUniversal).ToUniversalTime().ToString("o");
      string record=doc.SelectSingleNode("/e:Event/e:System/e:EventRecordID",ns).InnerText;
      int pages;int? count=Int32.TryParse(get("Param8"),out pages)&&pages>0&&pages<=1000000?(int?)pages:null;
      return new PrintEvent {eventKey=Program.Hash(Program.Channel+"\n"+record+"\n"+at),occurredAt=at,username=Program.Clean(get("Param3"),255),clientHostname=Program.Clean(get("Param4"),255),printerName=printer,port=Program.Clean(get("Param6"),255),pages=count,jobId=Program.Clean(get("Param1"),40)};
    }
  }

  internal class CollectorService : ServiceBase {
    ManualResetEvent stopped=new ManualResetEvent(false);Thread worker;
    public CollectorService(){ServiceName=Program.ServiceName;CanStop=true;AutoLog=false;}
    protected override void OnStart(string[] args){worker=new Thread(Run){IsBackground=true};worker.Start();}
    protected override void OnStop(){stopped.Set();if(worker!=null&&!worker.Join(25000))Program.Log("Finalização aguardando operação pendente; fila persistida.");}
    void Run(){
      Config config;string token;
      try{config=Program.Json().Deserialize<Config>(File.ReadAllText(Path.Combine(Program.Root,"config.json")));token=Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(config.protectedToken),null,DataProtectionScope.LocalMachine));}
      catch(Exception e){Program.Log("Configuração indisponível: "+e.GetType().Name);return;}
      do{try{Cycle(config,token);}catch(Exception e){Program.Log("Coleta pendente: "+e.GetType().Name+" "+e.Message);}}while(!stopped.WaitOne(30000));
    }
    void Cycle(Config config,string token){
      string cursorFile=Path.Combine(Program.Root,"cursor.json"),outbox=Path.Combine(Program.Root,"outbox");
      Cursor cursor=File.Exists(cursorFile)?Program.Json().Deserialize<Cursor>(File.ReadAllText(cursorFile)):new Cursor();
      var batch=new Batch();try{batch.queues=Inventory.Read();batch.health.inventoryOk=true;}catch{batch.health.warning="Não foi possível consultar as impressoras instaladas.";}
      using(var log=new EventLogConfiguration(Program.Channel))batch.health.logEnabled=log.IsEnabled;
      if(!batch.health.logEnabled)batch.health.warning="Registro de impressão desativado no Windows.";
      var newest=new EventLogQuery(Program.Channel,PathType.LogName,"*"){ReverseDirection=true};
      using(var reader=new EventLogReader(newest))using(var last=reader.ReadEvent())if(last!=null&&last.RecordId<cursor.recordId){cursor.recordId=0;cursor.warning="O registro do Windows foi reiniciado; o histórico pode ter lacunas.";}
      long backlogBytes=Directory.GetFiles(outbox,"*.json").Sum(p=>new FileInfo(p).Length);
      if(backlogBytes<100L*1024*1024&&batch.health.logEnabled){
        string start=DateTime.Parse(config.startedAt,CultureInfo.InvariantCulture,DateTimeStyles.AdjustToUniversal).ToUniversalTime().ToString("o");
        string filter="*[System[(EventID=307) and (EventRecordID > "+cursor.recordId.ToString(CultureInfo.InvariantCulture)+") and TimeCreated[@SystemTime >= '"+start+"']]]";
        using(var reader=new EventLogReader(new EventLogQuery(Program.Channel,PathType.LogName,filter))){
          for(int i=0;i<250;i++)using(var item=reader.ReadEvent()){
            if(item==null)break;
            PrintEvent entry=PrintParser.Parse(item.ToXml());
            if(entry!=null&&Inventory.Connection(null,entry.port,false)!="virtual"&&!(batch.queues??new List<PrinterQueue>()).Any(q=>q.name==entry.printerName&&q.connection=="virtual"))batch.events.Add(entry);
            cursor.recordId=item.RecordId.Value;
          }
        }
        batch.health.warning=batch.health.warning??cursor.warning;
        if(batch.events.Count>0)Program.AtomicWrite(Path.Combine(outbox,DateTime.UtcNow.ToString("yyyyMMddHHmmssfffffff")+"-"+Guid.NewGuid().ToString("N")+".json"),Program.Json().Serialize(batch));
        Program.AtomicWrite(cursorFile,Program.Json().Serialize(cursor));
      }else if(backlogBytes>=100L*1024*1024)batch.health.warning="Fila local cheia. A coleta aguarda envio ao servidor; o histórico pode ter lacunas.";
      foreach(string file in Directory.GetFiles(outbox,"*.json").OrderBy(p=>p).Take(10)){
        Delivery.SendFile(config.server,token,file);
      }
      batch.events.Clear();batch.health.backlog=Directory.GetFiles(outbox,"*.json").Length;
      Program.Post(config.server,"batches",batch,token);
    }
  }

  internal static class Delivery {
    public static void SendFile(string server,string token,string file){
      var pending=Program.Json().Deserialize<Batch>(File.ReadAllText(file));
      var ack=Program.Json().Deserialize<Dictionary<string,object>>(Program.Post(server,"batches",pending,token));
      if(!ack.ContainsKey("accepted")||Convert.ToInt32(ack["accepted"])!=pending.events.Count)throw new Exception("Servidor não confirmou o lote completo.");
      File.Delete(file);
    }
  }

  internal static class ServiceControl {
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr OpenSCManager(string machine,string database,uint access);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateService(IntPtr manager,string name,string display,uint access,uint type,uint start,uint error,string binary,string group,IntPtr tag,string dependencies,string account,string password);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr OpenService(IntPtr manager,string name,uint access);
    [DllImport("advapi32.dll",SetLastError=true)]static extern bool DeleteService(IntPtr service);
    [DllImport("advapi32.dll")]static extern bool CloseServiceHandle(IntPtr handle);
    public static bool Exists(){return ServiceController.GetServices().Any(s=>s.ServiceName==Program.ServiceName);}
    public static void Create(){
      IntPtr manager=OpenSCManager(null,null,0x0002);if(manager==IntPtr.Zero)throw new Win32Exception();
      try{IntPtr service=CreateService(manager,Program.ServiceName,"Hefesto — Coletor de computadores",0xF01FF,0x10,2,1,"\""+Program.InstalledExe+"\" --service",null,IntPtr.Zero,null,null,null);
        if(service==IntPtr.Zero)throw new Win32Exception();CloseServiceHandle(service);
      }finally{CloseServiceHandle(manager);}
    }
    public static void Start(){using(var service=new ServiceController(Program.ServiceName)){service.Start();service.WaitForStatus(ServiceControllerStatus.Running,TimeSpan.FromSeconds(20));}}
    public static void Remove(){
      if(!Exists())return;
      using(var service=new ServiceController(Program.ServiceName)){if(service.Status!=ServiceControllerStatus.Stopped){service.Stop();service.WaitForStatus(ServiceControllerStatus.Stopped,TimeSpan.FromSeconds(30));}}
      IntPtr manager=OpenSCManager(null,null,1);if(manager==IntPtr.Zero)throw new Win32Exception();
      try{IntPtr service=OpenService(manager,Program.ServiceName,0x10000);if(service==IntPtr.Zero)throw new Win32Exception();try{if(!DeleteService(service))throw new Win32Exception();}finally{CloseServiceHandle(service);}}finally{CloseServiceHandle(manager);}
    }
  }

  internal static class SelfTest {
    public static void Transport(string input,string output){
      var settings=Program.Json().Deserialize<Dictionary<string,string>>(File.ReadAllText(input));string server=settings["server"];
      if(!Program.ServerUri(server).IsLoopback)throw new Exception("Teste permitido somente em servidor temporário de loopback.");
      var auth=Program.Json().Deserialize<Dictionary<string,object>>(Program.Post(server,"enroll",new {code=settings["code"],hostname="PC-TEST-COLLECTOR",version=Program.Version},null));
      var batch=new Batch();batch.events.Add(new PrintEvent {eventKey="transport-test",occurredAt=DateTime.UtcNow.ToString("o"),username="TEST\\usuario",clientHostname="PC-TEST-COLLECTOR",printerName="Epson M1180 TEST",port="USB001",pages=2,jobId="1"});
      batch.queues=new List<PrinterQueue>{new PrinterQueue {key="test-queue",name="Epson M1180 TEST",driver="Epson M1180",port="USB001",connection="usb"}};batch.health.logEnabled=true;batch.health.inventoryOk=true;
      string spool=Path.Combine(Path.GetDirectoryName(output),"pending-test.json"),token=Convert.ToString(auth["token"]);Program.AtomicWrite(spool,Program.Json().Serialize(batch));
      bool failed=false;try{Delivery.SendFile(server,token,spool);}catch(WebException){failed=true;}
      if(!failed||!File.Exists(spool))throw new Exception("Lote sem confirmação precisa permanecer na fila.");
      Delivery.SendFile(server,token,spool);if(File.Exists(spool))throw new Exception("Lote confirmado deve sair da fila.");
      Program.AtomicWrite(output,Program.Json().Serialize(new {success=true,unacknowledgedBatchRetained=true,confirmedReplayRemoved=true,collectorId=auth["id"]}));
    }
    public static void Run(string output){
      string xml="<Event xmlns='http://schemas.microsoft.com/win/2004/08/events/event'><System><Provider Name='Microsoft-Windows-PrintService'/><EventID>307</EventID><TimeCreated SystemTime='2026-10-06T03:30:00Z'/><EventRecordID>123</EventRecordID></System><UserData><DocumentPrinted xmlns='http://manifests.microsoft.com/win/2005/08/windows/printing/spooler/core/events'><Param1>4</Param1><Param2>DOCUMENTO_SIGILOSO</Param2><Param3>EMPRESA\\teste</Param3><Param4>\\\\PC-TESTE</Param4><Param5>Epson M1180</Param5><Param6>USB001</Param6><Param7>500</Param7><Param8>3</Param8></DocumentPrinted></UserData></Event>";
      var result=PrintParser.Parse(xml);if(result.pages!=3||result.username!="EMPRESA\\teste"||result.clientHostname!=@"\\PC-TESTE"||result.printerName!="Epson M1180")throw new Exception("Leitura do evento falhou.");
      if(Program.Json().Serialize(result).Contains("DOCUMENTO_SIGILOSO"))throw new Exception("Nome do documento não pode ser coletado.");
      if(PrintParser.Parse(xml.Replace("<Param8>3</Param8>","<Param8>0</Param8>")).pages!=null)throw new Exception("Quantidade desconhecida foi convertida em zero.");
      if(PrintParser.Parse(xml).eventKey!=result.eventKey)throw new Exception("Chave idempotente instável.");
      if(PrintParser.Parse(xml.Replace("<EventRecordID>123</EventRecordID>","<EventRecordID>124</EventRecordID>")).eventKey==result.eventKey)throw new Exception("Colisão de evento.");
      if(Inventory.Connection("Epson M1180","USB001",false)!="usb"||Inventory.Connection("Epson M1180","IP_198.18.8.1",true)!="tcpip"||Inventory.Connection("Microsoft Print to PDF","PORTPROMPT:",false)!="virtual")throw new Exception("Classificação da conexão falhou.");
      Program.AtomicWrite(output,Program.Json().Serialize(new {success=true,parser=true,privateDocumentNameOmitted=true,unknownPagesPreserved=true,eventDeduplication=true,usbAndIpClassification=true,version=Program.Version}));
    }
  }
}
