using System.Text.Json.Serialization;

namespace Docgit.Dto
{
    public class LogInReqDto
    {
        [JsonPropertyName("user")]
        public string User { get; set; } = string.Empty;

        public string UserName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;

        

        


    }
}
