const emailjs = require('@emailjs/nodejs');


function sendEmail(device_name) {
    const templateParams = {
        email: 'btlhcmut8386@gmail.com',
        device_name: device_name,
    };
    return emailjs.send("service_5sktok8", "template_4a6h46a", templateParams, { publicKey: "MHJOY4ulk5PA3x8BI", privateKey: "c2sJEfdAYeupQ1uFu0u56" })
        .then((response) => {
            console.log('SUCCESS!', response.status, response.text);
            return { success: true, response };
        })
        .catch((error) => {
            console.log('FAILED...', error);
            throw error;
        });
}

module.exports = sendEmail;