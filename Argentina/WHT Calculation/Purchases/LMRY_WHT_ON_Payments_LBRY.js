/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for WHT on Payment Library                     ||
||                                                              ||
||  File Name: LMRY_WHT_ON_Payments_LBRY.js				       ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Abr 17 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
 /**
  * @NApiVersion 2.x
  * @NModuleScope Public
  */
 define(['N/log', 'N/xml', 'N/format', 'N/search', 'N/runtime', 'N/url', 'N/email'],

     function(log, xml, format, search, runtime, url, email) {
 		 /**************************************************************
 		  * Funcion para validar si tiene activo el feature del
 		  * pais al cual esta accesando
 		  *********************************************************** */
 		   function getAuthorization(featureId)
 		   {
 			    var secretPhrase = 'La venganza nunca es buena, mata el alma y la envenena';
 			    var resulAuthorization = false;
 			    var customerId = runtime.accountId;

 			    busqLatamLicense = search.create({
 			                type: 'customrecord_latam_licenses',
 			                columns: ['custrecord_latam_customer', 'custrecord_latam_feature',
 			                            'custrecord_expiration_date', 'custrecord_encrypted_data' ],
 			                filters: [ ['custrecord_latam_feature', 'is', featureId], 'and', ['custrecord_latam_customer', 'is', customerId] ]
 			            });

 		       resultLatamLicense = busqLatamLicense.run().getRange(0, 10);
 		       if(resultLatamLicense != null && resultLatamLicense.length != 0)
 		       {
 		           row  = resultLatamLicense[0].columns;
 		           custo      = resultLatamLicense[0].getValue(row[0]);
 		           featureId  = resultLatamLicense[0].getValue(row[1]);
 		           expiration  = resultLatamLicense[0].getValue(row[2]);
 		           encryptedLicence  = resultLatamLicense[0].getValue(row[3]);

 		           var expirationDate = format.parse({ value: expiration,type: format.Type.DATE });

 			        var day   = expirationDate.getDate();
 			        var month = expirationDate.getMonth()+1;
 			        var year  = expirationDate.getFullYear();
 			        var checkKey  = [customerId, featureId, day, month, year, secretPhrase].join('|');

 			        //var encryptedCheckKey = nlapiEncrypt( checkKey );

 			        if (  new Date() < expirationDate )
 			        {
 				        //if ( encryptedLicence == encryptedCheckKey && new Date() < expirationDate ) {
 				        busqEnabledFeature = search.create({
 				                        type: 'customrecord_latam_enabled_features',
 				                        columns: ['custrecord_latam_enabled_feature' ],
 				                        filters: [ ['custrecord_latam_enabled_feature', 'is', featureId] ]
 				                    });

 				        resultEnabledFeature = busqEnabledFeature.run().getRange(0, 10);

 					    if ( resultEnabledFeature && resultEnabledFeature.length > 0 )
 					    {
 					    		resulAuthorization = true;
 					    }
 				    }
 		       }
 		       return resulAuthorization;
 		   }

    		/**************************************************************
 		 * Funcion para enviar correo en el caso que se presente
 		 * un error en el script.
 		 *********************************************************** */
 		function sendMail(namescript, errdecrip)
 		{
 			var IsUndefi = (typeof errdecrip == 'undefined');
 			var IsObject = (typeof errdecrip == 'object');
 			var IsString = (typeof errdecrip == 'string');
 			var IsNumber = (typeof errdecrip == 'number');
 			log.error('Is undefined', IsUndefi );
 			log.error('Is object'	, IsObject );
 			log.error('Is string'	, IsString );
 			log.error('Is number'	, IsNumber );

 			/* Formato de las columnas de la tabla */
 			var colStyl = 'style=\"text-align: center; font-size: 9pt; font-weight:bold; color:white; background-color:#d50303; border: 1px solid #d50303; ';
 			var rowStyl = 'style=\"text-align: Left;   font-size: 9pt; font-weight:bold; border: 1px solid #d50303; ';
 			var errStyl = 'style=\"text-align: Left;   font-size: 9pt; font-weight:bold; color:red;border: 1px solid #d50303; ';

 			var width_td1 = " width:40%;\">";
 			var width_td2 = " width:60%;\">";

 			// Datos del Usuario
 			var nameUser  = '';
 			var emailUser = '';
 			var empfir = '';

 	  		// ID del usuario a consultar
 			user_emp = ' ' + runtime.getCurrentUser().id;
 	        if (user_emp < 1) {
 	          user_emp = ' ' + runtime.getCurrentScript().getParameter('custscript_lmry_employee_manager');

           // Convierte a numero
           user_emp = parsetInt(user_emp);

 	          // Datos del empleado
 	          var recEmp = search.lookupFields({
 	            type   : search.Type.EMPLOYEE,
 	            id     : user_emp,
 	            columns: ['firstname', 'email']
 	          });

 	          nameUser  = recEmp.firstname;
 	          emailUser = recEmp.email;
 	          empfir = recEmp.firstname;
 	        }else{
 	          nameUser  = runtime.getCurrentUser().name;
 	          emailUser = runtime.getCurrentUser().email;
 	          empfir    = nameUser;
 	        }

 			// Datos de la Empresa
 			var namevers = runtime.version;
 			var namecomp = runtime.accountId;
 			var nametype = 'Suite Script SuiteLet';
 			var namerdid = '-none-';
 			// Datos del Usuario
 			var userObj = runtime.getCurrentUser();
 			var nameuser = userObj.name;
 			var namerole = userObj.roleId;
 			var nameroce = userObj.roleCenter;
 			var namesubs = userObj.subsidiary;
 			var datetime = new Date();

 			var bmsg = '';
 		    	bmsg += "<table style=\"font-family: Courier New, Courier, monospace; width:580px; border: 1px solid #d50303;\">";
 	    		bmsg += "<tr>";
 	    			bmsg += "<td " + colStyl + width_td1 + "Descripcion </td>";
 	    			bmsg += "<td " + colStyl + width_td2 + "Detalle </td>";
 	    		bmsg += "</tr>";
 	    		bmsg += "<tr>";
 	    			bmsg += "<td " + rowStyl + width_td1;
 	    				bmsg += "Fecha y Hora";
 	    			bmsg += "</td>";
 	    			bmsg += "<td " + rowStyl + width_td2;
 	    				bmsg += datetime;
 	    			bmsg += "</td>";
 	    		bmsg += "</tr>";
 	    		bmsg += "<tr>";
 	    			bmsg += "<td " + rowStyl + width_td1;
 	    				bmsg += "NetSuite Version (Release)";
 	    			bmsg += "</td>";
 	    			bmsg += "<td " + rowStyl + width_td2;
 	    				bmsg += namevers;
 	    			bmsg += "</td>";
 	    		bmsg += "</tr>";
 	    		bmsg += "<tr>";
 	    			bmsg += "<td " + rowStyl + width_td1;
 	    				bmsg += "Codigo Cliente (Company)";
 	    			bmsg += "</td>";
 	    			bmsg += "<td " + rowStyl + width_td2;
 	    				bmsg += namecomp;
 	    			bmsg += "</td>";
 	    		bmsg += "</tr>";
 	    		bmsg += "<tr>";
 	    			bmsg += "<td " + rowStyl + width_td1;
 	    				bmsg += "Subsidiaria del Usuario (ID)";
 	    			bmsg += "</td>";
 	    			bmsg += "<td " + rowStyl + width_td2;
 	    				bmsg += namesubs;
 	    			bmsg += "</td>";
 	    		bmsg += "</tr>";
 	    		bmsg += "<tr>";
 	    			bmsg += "<td " + rowStyl + width_td1;
 	    				bmsg += "Nombre de Usuario (User) ";
 	    			bmsg += "</td>";
 	    			bmsg += "<td " + rowStyl + width_td2;
 	    				bmsg += nameuser;
 	    			bmsg += "</td>";
 	    		bmsg += "</tr>";
 	    		// Verifica que este dentro de una transaccion
 	    		if (nametype!='' && nametype!=null) {
 	    			bmsg += "<tr>";
 	    				bmsg += "<td " + rowStyl + width_td1;
 	    					bmsg += "Tipo de Transaccion (Type) ";
 	    				bmsg += "</td>";
 	    				bmsg += "<td " + rowStyl + width_td2;
 	    					bmsg += nametype;
 	    				bmsg += "</td>";
 	    			bmsg += "</tr>";
 	    			bmsg += "<tr>";
 	    				bmsg += "<td " + rowStyl + width_td1;
 	    					bmsg += "Numero interno de la Transaccion (Internal ID) ";
 	    				bmsg += "</td>";
 	    				bmsg += "<td " + rowStyl + width_td2;
 	    					bmsg += namerdid;
 	    				bmsg += "</td>";
 	    			bmsg += "</tr>";
 	    		}
 	    		bmsg += "<tr>";
 	    			bmsg += "<td " + rowStyl + width_td1;
 	    				bmsg += "Role Center (Role)";
 	    			bmsg += "</td>";
 	    			bmsg += "<td " + rowStyl + width_td2;
 	    				bmsg += nameroce;
 	    			bmsg += "</td>";
 	    		bmsg += "</tr>";
 	    		bmsg += "<tr>";
 	    			bmsg += "<td " + rowStyl + width_td1;
 	    				bmsg += "ID Rol del usuario (Role)";
 	    			bmsg += "</td>";
 	    			bmsg += "<td " + rowStyl + width_td2;
 	    				bmsg += namerole;
 	    			bmsg += "</td>";
 	    		bmsg += "</tr>";
 	    		bmsg += "<tr>";
 	    			bmsg += "<td " + rowStyl + width_td1;
 	    				bmsg += 'Script ' + namescript + '';
 	    			bmsg += "</td>";
 	    			bmsg += "<td " + errStyl + width_td2;
 		    			// Inicio - Detallar el error producido
 						if (IsObject)
 						{
 							var sAux = '';
 								sAux += 'Name : ' 	+ errdecrip.name 	+ '<br></br>';
 								sAux += 'Message : '+ errdecrip.message;
 							bmsg += sAux;
 							log.error('Error name', errdecrip.name);
 							log.error('Error message', errdecrip.message);
 						}
 						if (IsString)
 						{
 							// Inicio - ReferenceError
 							var posExist = errdecrip.indexOf('ReferenceError');
 							if (posExist>0){
 								bmsg += errdecrip;
 							}else{
 								// Inicio - Arma resultado
 			    				bmsg += '<table>';
 				    				bmsg += '<tr>';
 					    				bmsg += '<td>';
 					    				bmsg += 'Type';
 					    				bmsg += '</td>';
 					    				bmsg += '<td>';
 					    				bmsg += ':';
 					    				bmsg += '</td>';
 					    				bmsg += '<td>';
 					    				bmsg += Send_GetResult(errdecrip,'"type"');
 					    				bmsg += '</td>';
 				    				bmsg += '</tr>';
 									bmsg += '<tr>';
 					    				bmsg += '<td>';
 					    				bmsg += 'Code';
 					    				bmsg += '</td>';
 					    				bmsg += '<td>';
 					    				bmsg += ':';
 					    				bmsg += '</td>';
 					    				bmsg += '<td>';
 					    				bmsg += Send_GetResult(errdecrip,'"code"');
 					    				bmsg += '</td>';
 				    				bmsg += '</tr>';
 				    				bmsg += '<tr>';
 					    				bmsg += '<td>';
 					    				bmsg += 'Message';
 					    				bmsg += '</td>';
 					    				bmsg += '<td>';
 					    				bmsg += ':';
 					    				bmsg += '</td>';
 					    				bmsg += '<td>';
 					    				bmsg += Send_GetResult(errdecrip,'"message"');
 					    				bmsg += '</td>';
 				    				bmsg += '</tr>';
 				    				bmsg += '<tr>';
 					    				bmsg += '<td>';
 					    				bmsg += 'User Event:';
 					    				bmsg += '</td>';
 					    				bmsg += '<td>';
 					    				bmsg += ':';
 					    				bmsg += '</td>';
 					    				bmsg += '<td>';
 					    				bmsg += Send_GetResult(errdecrip,'"userEvent"');
 					    				bmsg += '</td>';
 				    				bmsg += '</tr>';
 			    				bmsg += '</table>';
 							}
 							// Fin - ReferenceError
 						}
 						// Fin - Detallar el error producido
 	    			bmsg += "</td>";
 	    		bmsg += "</tr>";
 	    		bmsg += "</table>";

 			// Envio de email
 			var subject = 'NS - Bundle Latinoamerica - User Error';
 			var body =  '<body text="#333333" link="#014684" vlink="#014684" alink="#014684">';
 				body += '<table width="642" border="0" align="center" cellpadding="0" cellspacing="0">';
 				body += '<tr>';
 				body += '<td width="100%" valign="top">';
 				body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
 				body += '<tr>';
 				body += '<td width="100%" colspan="2"><img style="display: block;" src="https://system.na1.netsuite.com/core/media/media.nl?id=921&c=TSTDRV1038915&h=c493217843d184e7f054" width="645" alt="main banner"/></td>';
 				body += '</tr>';
 				body += '</table>';
 				body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
 				body += '<tr>';
 				body += '<td bgcolor="#d50303" width="15%">&nbsp;</td>';
 				body += '<td bgcolor="#d50303" width="85%">';
 				body += '<font style="color:#FFFFFF; line-height:130%; font-family:Arial, Helvetica, sans-serif; font-size:19px">';
 				body += 'Estimado(a) ' + empfir + ':<br>';
 				body += '</font>';
 				body += '</td>';
 				body += '</tr>';
 				body += '<tr>';
 				body += '<td width="100%" bgcolor="#d50303" colspan="2" align="right"><a href="http://www.latamready.com/#contac"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=923&c=TSTDRV1038915&h=3c7406d759735a1e791d" width="94" style="margin-right:45px" /></a></td>';
 				body += '</tr>';
 				body += '<tr>';
 				body += '<td width="100%" bgcolor="#FFF" colspan="2" align="right">';
 				body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=924&c=TSTDRV1038915&h=c135e74bcb8d5e1ac356" width="15" style="margin:5px 1px 5px 0px" /></a>';
 				body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=919&c=TSTDRV1038915&h=9c937774d04fb76747f7" width="15" style="margin:5px 1px 5px 0px" /></a>';
 				body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=928&c=TSTDRV1038915&h=fc69b39a8e7210c65984" width="15" style="margin:5px 47px 5px 0px" /></a>';
 				body += '</td>';
 				body += '</tr>';
 				body += '</table>';
 				body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
 				body += '<tr>';
 				body += '<td width="15%">&nbsp;</td>';
 				body += '<td width="70%">';
 				body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:13px">';
 				body += '<p>Este es un mensaje de error automático de LatamReady SuiteApp.</p>';
 				body += '<p>El detalle es el siguiente:</p>';
 				body += bmsg;
 				body += '<p>Por favor, comunícate con nuestro departamento de Servicio al Cliente a: customer.care@latamready.com</p>';
 				body += '<p>Nosotros nos encargamos.</p>';
 				body += '<p>Saludos,</p>';
 				body += '<p>El Equipo de LatamReady</p>';
 				body += '</font>';
 				body += '</td>';
 				body += '<td width="15%">&nbsp;</td>';
 				body += '</tr>';
 				body += '</table>';
 				body += '<br>';
 				body += '<table width="100%" border="0" cellspacing="0" cellpadding="2" bgcolor="#e5e6e7">';
 				body += '<tr>';
 				body += '<td>&nbsp;</td>';
 				body += '</tr>';
 				body += '<tr>';
 				body += '<td width="15%">&nbsp;</td>';
 				body += '<td width="70%" align="center">';
 				body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:12px;" >';
 				body += '<i>Este es un mensaje automático. Por favor, no responda este correo electrónico.</i>';
 				body += '</font>';
 				body += '</td>';
 				body += '<td width="15%">&nbsp;</td>';
 				body += '</tr>';
 				body += '<tr>';
 				body += '<td>&nbsp;</td>';
 				body += '</tr>';
 				body += '</table>';
 				body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
 				body += '<tr>';
 				body += '<td width="15%">&nbsp;</td>';
 				body += '<td width="70%" align="center">';
 				body += '<a href="http://www.latamready.com/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=926&c=TSTDRV1038915&h=e14f0c301f279780eb38" width="169" style="margin:15px 0px 15px 0px" /></a>';
 				body += '</td>';
 				body += '<td width="15%">&nbsp;</td>';
 				body += '</tr>';
 				body += '</table>';
 				body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
 				body += '<tr>';
 				body += '<td width="15%">&nbsp;</td>';
 				body += '<td width="70%" align="center">';
 				body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=925&c=TSTDRV1038915&h=41ec53b63dba135488be" width="101" style="margin:0px 5px 0px 5px" /></a>';
 				body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=920&c=TSTDRV1038915&h=7fb4d03fff9283e55318" width="101" style="margin:0px 5px 0px 5px" /></a>';
 				body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=929&c=TSTDRV1038915&h=300c376863035d25c42a" width="101" style="margin:0px 5px 0px 5px" /></a>';
 				body += '</td>';
 				body += '<td width="15%">&nbsp;</td>';
 				body += '</tr>';
 				body += '</table>';
 				body += '<table width="100%" border="0" cellspacing="0">';
 				body += '<tr>';
 				body += '<td>';
 				body += '<img src="https://system.na1.netsuite.com/core/media/media.nl?id=918&c=TSTDRV1038915&h=7f0198f888bdbb495497" width="642" style="margin:15px 0px 15px 0px" /></a>';
 				body += '</td>';
 				body += '</tr>';
 				body += '</table>';
 				body += '</td>';
 				body += '</tr>';
 				body += '</table>';
 				body += '</body>';

 			body = xml.escape(body);

 			// Correos
 			var bcc = new Array();
 			var cco = new Array();
 				cco[0] = 'customer.voice@latamready.com';

 	  		// Executionlog
 	  		log.error("user_emp, nameUser - emailUser", user_emp + " - " + nameUser + " - " + emailUser);

 	  		try{
 	              // Envio de mail
 	              email.send({
 	                  author: user_emp,
 	                  recipients: emailUser,
 	                  bcc: cco,
 	                  subject: subject,
 	                  body: body
 	              });
 	        }catch(MsgError){
 				if (typeof MsgError == 'object')
 				{
 	              log.error("email.send - name", MsgError.name);
 	              log.error("email.send - message", MsgError.message);
 				}else{
 	              log.error("email.send", MsgError);
 				}
 	        }
 		}
 		/**************************************************************
 	    * Extrae los valores obtenidos del arreglo
 	    * como se muestra a continuacion.
 	    * Ejemplo:
 	    * 			array[0]="Nombre Campo":"Valor"
 	    *  		field = "Nombre Campo"
 	    *  		strdata = array[0]
 	    *********************************************************** */
 	   function Send_GetResult(strdata, field)
 	   {
 			var intpos = strdata.indexOf(field);
 			var straux = strdata.substr(parseInt(intpos)+parseInt(field.length)+1);
 			var auxpos = straux.indexOf('",');
 			var strcad = '';
 			if (intpos>0)
 			{
 				// Extrae la cadena hasta desde (",)
 				straux = straux.substr(0,auxpos+1);
 				// Valida que el campo no de null
 				if (straux=='null' || straux=='')
 				{
 					return '';
 				}
 				return straux;
 			}
 	   }

 	   return {
 		   getAuthorization:getAuthorization,
 		   sendMail: sendMail
 	      };
     });
