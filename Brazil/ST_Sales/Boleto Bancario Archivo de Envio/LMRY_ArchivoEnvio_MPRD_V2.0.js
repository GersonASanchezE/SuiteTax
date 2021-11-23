/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                    ||
||                                                             ||
||  File Name: LMRY_ArchivoEnvio_MPRD_V2.0.js     	           ||
||                                                             ||
||  Version Date         Author        Remarks                 ||
||  1.0     Ago 26 2019  LatamReady    Use Script 2.0          ||
\= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */

define(['N/log', 'N/record', 'N/search', 'N/format', 'N/runtime', 'N/email', 'N/config', 'N/file', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
  function(log, record, search, format, runtime, email, config, file, libraryMail) {

    // Define characters that should not be counted when the script performs its
    // analysis of the text.
    //Datos de la Configuracion (Subsidiaria - Bank of America Merrill Lynch)
    var codigoBeneficiario = '';
    var codigoCartera = '';
    var codigoBanco = '';
    var aceptacion = '';
    var cuentaCobro = '';
    //modificacion para el nombre del archivo de envio 3/10/2019
    var file_name = '';
    var formatoFechaNameFile = '';
    //fin modificacion para el nombre del archivo de envio


    //Datos de la Subsidiaria/Beneficiario
    var nombreSubsidiaria = '';
    var cnpjSubsidiaria = '';

    //Datos del Customer/Pagador
    var nomCustomer = '';
    var cnpjCustomer = '';
    var addressCustomer = '';
    var tipoCustomer = '';
    var emailCustomer = '';
    var bairroCustomer = '';
    var cepCustomer = '';
    var ciudadCustomer = '';
    var ufCustomer = '';

    //Datos del Invoice
    var dateInvoice = '';
    var dueDateInvoice = '';
    var montoTotalInvoice = '';
    var numPreImpreso = '';
    var memo = '';


    var complementoRegistro = '';
    var nossoNumero = '';

    // FEATURE SUITETAX
    var ST_FEATURE = false;

    var LMRY_script = 'LatamReady - Archivo de Envio MPRD';
    var FLAG = false;
    var COD_EMPRESA = '';

    // Use the getInputData function to return two strings.

    function getInputData() {
      try {
        //Crea la carpeta si no existe
        search_folder();

        var id_record_log = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_record_log_id_mprd'
        });

        var record_br_log_shipping_file = record.load({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_record_log
        });

        var subsidiaria = record_br_log_shipping_file.getValue({
          fieldId: 'custrecord_lmry_br_log_subsidiary'
        });
        var fecha_desde = record_br_log_shipping_file.getText({
          fieldId: 'custrecord_lmry_br_log_date_from'
        });
        var fecha_hasta = record_br_log_shipping_file.getText({
          fieldId: 'custrecord_lmry_br_log_date_to'
        });

        //Búsqueda de invoices
        var columns = [
          'internalid', 'trandate', 'subsidiary', 'status',
          "custrecord_lmry_br_related_transaction.custrecord_lmry_br_send_multa",
          "custrecord_lmry_br_related_transaction.custrecord_lmry_br_send_interes"
        ];

        //Features
        var licenses = libraryMail.getLicenses(subsidiaria);
        var FEATURE_INST = runtime.isFeatureInEffect({
          feature: "installments"
        });

        if ((FEATURE_INST == 'T' || FEATURE_INST == true) && libraryMail.getAuthorization(536, licenses)) {
          columns.push(search.createColumn({
            name: "internalid",
            sort: search.Sort.DESC
          }));
          columns.push(search.createColumn({
            name: "installmentnumber",
            join: "installment",
            sort: search.Sort.ASC
          }));
          columns.push("custrecord_lmry_br_related_transaction.custrecord_lmry_br_installments");
          columns.push("installment.amount");
          columns.push("installment.duedate");
        }

        return search.create({
          type: 'invoice',
          columns: columns,
          filters: [
            ["mainline", "is", "T"],
            "AND", ["subsidiary", "is", subsidiaria],
            "AND", ["trandate", "within", fecha_desde, fecha_hasta],
            //"AND", ["custbody_lmry_informacion_adicional", "isnotempty", ""],
            /*"CustInvc:V" - voided,
            "CustInvc:B" - paidInFull,
            "CustInvc:A" - open*/
            "AND", ["status", "anyof", ["CustInvc:A", "CustInvc:V", "CustInvc:B"]]
          ],
          settings: [search.createSetting({
            name: 'consolidationtype',
            value: 'NONE'
          })]
        });

      } catch (error) {
        log.error('Error', error);
        libraryMail.sendemail(' [ getInputData ] ' + error, LMRY_script);
        return true;
      }
    }

    function map(context) {
      try {
        var searchResult = JSON.parse(context.value);
        var invoiceID = searchResult.id;
        var trandate = searchResult.values.trandate;
        var subsidiary = searchResult.values.subsidiary.value;
        var status = searchResult.values.status.value;
        MORA_DIA = searchResult.values['custrecord_lmry_br_send_interes.custrecord_lmry_br_related_transaction'];
        MULTA = searchResult.values['custrecord_lmry_br_send_multa.custrecord_lmry_br_related_transaction'];
        RETENCION_INST = searchResult.values['custrecord_lmry_br_installments.custrecord_lmry_br_related_transaction'];
        ID_INST = searchResult.values["installmentnumber.installment"];
        AMOUNT_INST = searchResult.values["amount.installment"];
        DUEDATE_INST = searchResult.values["duedate.installment"];

        var haveStatus = true;
        if (status == 'voided' || status == 'paidInFull') {
          haveStatus = getPedidoBaixa(invoiceID);
        }
        if (haveStatus) {
          obtenerDatosSubsidiaria(subsidiary);
          obtenerDatosConfigSubsidiariaBancoBOA(subsidiary);
          context.write({
            key: trandate,
            value: obtenerDetalleRegistroObli(invoiceID, 0) //+''+invoiceID;//secuencia temporal
          });
        }

      } catch (error) {
        log.error('invoiceID - Trandate', invoiceID + ' - ' + trandate);

        context.write({
          key: 0,
          value: invoiceID
        });
      }

    }

    function reduce(context) {}

    function summarize(context) {
      var array_file = {};
      var id_file_array = [];
      context.output.iterator().each(function(key, value) {
        //log.debug('Details',key);
        if (array_file[key]) {
          array_file[key].push(value);
        } else {
          array_file[key] = [value];
        }

        return true;
      });
      try {

        if (array_file.length == 0)
          throw 'There is not content.';

        // Ruta de la carpeta contenedora
        var id_folder = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_arquivo_remessa'
        });
        var id_record_log = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_record_log_id_mprd'
        });
        var record_br_log_shipping_file = record.load({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_record_log
        });

        var subsidiaria = record_br_log_shipping_file.getValue({
          fieldId: 'custrecord_lmry_br_log_subsidiary'
        });

        var fechaDeCreacionArchivo = new Date();
        var horas = fechaDeCreacionArchivo.getHours();
        horas = completarInicio(horas, 2, '0');
        var minutos = fechaDeCreacionArchivo.getMinutes();
        minutos = completarInicio(minutos, 2, '0');
        var segundos = fechaDeCreacionArchivo.getSeconds();
        segundos = completarInicio(segundos, 2, '0');

        var cabecera = obtenerCabeceraArchivo(subsidiaria);

        for (var fecha in array_file) {
          // Posible fallo de tiempo
          formatoFecha(fecha);
          var cadena = cabecera;
          var i;
          for (i = 0; i < array_file[fecha].length; i++) {
            cadena += reemplazarSecuencia(array_file[fecha][i], i + 2);
          }
          cadena += '\n';
          cadena += obtenerTrailerArchivo(i + 2);

          cadena = ValidarCaracteres_Especiales(cadena);


          var fileRemesa = file.create({
            name: 'bamlCollection-' + file_name + '-' + formatoFechaNameFile + '-' + horas + minutos + segundos + '.rem',
            fileType: file.Type.PLAINTEXT,
            contents: cadena,
            folder: id_folder
          });
          var id_file = fileRemesa.save();
          id_file_array.push(id_file);
        }


        record.submitFields({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_record_log,
          values: {
            custrecord_lmry_br_log_idfile: id_file_array.join('|'),
            custrecord_lmry_br_log_state: 'Finalized'
          },
          option: {
            disableTriggers: true // con esto se evita que se bloquee el record, osea que no funciones los userevent
          }
        });

      } catch (error) {
        log.error('summarize', error);
        var id_record_log = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_record_log_id_mprd'
        });
        //Cambiando el estado al registro  "LatamReady - BR Shipping File" - ERROR

        record.submitFields({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_record_log,
          values: {
            custrecord_lmry_br_log_state: 'Error'
          },
          option: {
            disableTriggers: true // con esto se evita que se bloquee el record, osea que no funciones los userevent
          }

        });
        libraryMail.sendemail(' [ summarize ] ' + error, LMRY_script);
        return true;
      }
    }

    function ValidarCaracteres_Especiales(s) {
      var AccChars = "ŠŽšžŸÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïðñòóôõöùúûüýÿ°–—ªº·";
      var RegChars = "SZszYAAAAAACEEEEIIIIDNOOOOOUUUUYaaaaaaceeeeiiiidnooooouuuuyyo--ao.";
      s = s.toString();
      for (var c = 0; c < s.length; c++) {
        for (var special = 0; special < AccChars.length; special++) {
          if (s.charAt(c) == AccChars.charAt(special)) {
            s = s.substring(0, c) + RegChars.charAt(special) + s.substring(c + 1, s.length);
          }
        }
      }
      return s;
    }

    function reemplazarSecuencia(texto, sec) {
      var numero = completarInicio(sec, 6, 0); //secuencia 6 digitos
      // log.debug('reemplazarSecuencia', numero);
      var inicio = texto.substring(0, 395);
      var final = texto.substring(401, 711);
      return inicio + numero + final;
    }

    function obtenerDatosConfigSubsidiariaBancoBOA(id_subsidiaria) {
      //busqueda del record customrecord_lmry_br_config_bank_ticket para la config: Subsiiaria - BOA
      var searchConfigSubsiBank = search.create({
        type: 'customrecord_lmry_br_config_bank_ticket',
        columns: [{
          name: 'custrecord_lmry_name_subsidiary'
        }, {
          name: 'custrecord_lmry_beneficiary_code'
        }, {
          name: 'custrecord_lmry_code_bank'
        }, {
          name: 'custrecord_lmry_bank_code_cartera'
        }, {
          name: 'custrecord_lmry_bank_accept_bank_ticket'
        }, {
          name: 'custrecord_lmry_collection_account'
        }, {
          name: 'custrecord_lmry_file_name'
        }, {
          name: 'internalid'
        }],
        filters: ['custrecord_lmry_name_subsidiary', 'is', id_subsidiaria]
      });
      var searchResult = searchConfigSubsiBank.run().getRange(0, 1);

      if (searchResult != '' && searchResult != null) {

        codigoBeneficiario = searchResult[0].getValue({
          name: 'custrecord_lmry_beneficiary_code'
        });
        codigoBanco = searchResult[0].getValue({
          name: 'custrecord_lmry_code_bank'
        });
        codigoCartera = searchResult[0].getValue({
          name: 'custrecord_lmry_bank_code_cartera'
        });
        aceptacion = searchResult[0].getValue({
          name: 'custrecord_lmry_bank_accept_bank_ticket'
        });
        if (aceptacion == 1) {
          aceptacion = "A";
        } else {
          aceptacion = "N";

        }
        cuentaCobro = searchResult[0].getValue({
          name: 'custrecord_lmry_collection_account'
        });

        //modificacion para el nombre del archivo de envio 3/10/2019
        file_name = searchResult[0].getValue({
          name: 'custrecord_lmry_file_name'
        });
        //Fin modificacion para el nombre del archivo de envio

      }
    }

    // Datos de la Subsidiaria
    function obtenerDatosSubsidiaria(id_subsidiaria) {

      if (id_subsidiaria != 0) {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var subsidiaria = record.load({
          type: record.Type.SUBSIDIARY,
          id: id_subsidiaria,
          isDynamic: true
        });

        /**
         * Para SuiteTax
         */
        if(ST_FEATURE || ST_FEATURE === "T") {
          var subsidiary_nexus = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_baml_subsidiary_nexus' });
          var taxregnum_lines_subsidiaries = subsidiaria.getLineCount({ sublistId: 'taxregistration' });
          for(var x = 0; x < taxregnum_lines_subsidiaries; x++) {
            var sub_nexus = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'nexus', line: x });
            if(subsidiary_nexus === sub_nexus){
              var subsidiary_cnpj = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'taxregistrationnumber', line: x });
              break;
            }
          }
        }

        nombreSubsidiaria = subsidiaria.getValue({
          fieldId: 'legalname'
        });

        if (nombreSubsidiaria == '' || nombreSubsidiaria == null) {
          nombreSubsidiaria = subsidiaria.getValue({
            fieldId: 'name'
          });
        }

        var cnpjSubsidiaria = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpjSubsidiaria = subsidiaria.getValue({ fieldId: 'federalidnumber' });
        } else {
          cnpjSubsidiaria = subsidiary_cnpj;
        }

      }
      return true;
    }

    function obtenerDigitoVerificador(campo) {
      var digitoVerificador;
      var vector = [];
      var i, j;
      var suma = 0;
      var digitoMultiplicado;

      //para calcular el digito verificador se hace uso de 12 digitos: Codigo de cartera + NossoNumero
      var campo = codigoCartera + campo;

      for (i = campo.length - 1; i >= 0; i--) {
        digito = campo[i];
        digito_int = parseInt(digito);
        vector.push(digito_int);
      }

      var t = 2;

      for (j = 0; j < vector.length; j++) {

        if (t <= 7) {
          digitoMultiplicado = vector[j] * t;
          t++;

        } else {
          t = 2;
          digitoMultiplicado = vector[j] * t;
          t++;
        }
        suma += digitoMultiplicado;
      }

      var resto = suma % 11;
      if (resto == 0) {
        digitoVerificador = 0;
      } else if (resto == 1) {
        digitoVerificador = 'P';
      } else {
        digitoVerificador = 11 - resto;
      }

      return digitoVerificador;
    }


    function formandoNossoNumero(idInvoice, cod) {
      var nn = '';
      var cadena = '';

      if (cod) {
        cadena = idInvoice + cod;
      } else {
        cadena = idInvoice;
      }
      cadena = cadena.toString();

      while (cadena.length < 10) {
        cadena = "0" + cadena
      }

      if (cadena.lentgh > 10) {
        cadena = cadena.substring(0, 10);
      }

      var dv = obtenerDigitoVerificador(cadena);
      nn = '0' + cadena + dv.toString();

      return nn;
    }

    function obtenerCabeceraArchivo(subsidiaria) {

      var string = "";
      obtenerDatosConfigSubsidiariaBancoBOA(subsidiaria);
      obtenerDatosSubsidiaria(subsidiaria);

      string += '0'; // Tipo de Registro
      string += '1'; //Codigo de Remesa
      string += 'REMESSA'; //Literal Remessa
      string += '01'; //Codigo Servicio
      string += 'COBRANCA'; //literalServicio
      string += completarInicio(complementoRegistro, 7, ' '); //Complemento de Registro A(7)
      string += completarInicio(codigoBeneficiario, 12, '0'); //Codigo Beneficiario
      string += completarInicio(complementoRegistro, 8, ' '); //Complemento de Registro A(8)
      string += completarFinal(nombreSubsidiaria, 30, ' '); //Nombre de la subsidiaria
      string += completarInicio(codigoBanco, 3, '0'); //codigoBanco
      string += completarInicio(complementoRegistro, 15, ' '); //Complemento de Registro A(15)
      var fechaCreacion = new Date();
      string += formatoFecha(fechaCreacion);; //Fecha Grabacion del archivo de Remessa
      string += completarInicio(complementoRegistro, 286, ' '); //Complemento de Registro A(286)
      string += '00000001' //Secuencia Remesa
      string += '000001'; //Secuencia

      // var remainingUsage1 = runtime.getCurrentScript().getRemainingUsage();
      // log.debug('Memoria consumida', remainingUsage1);

      return string;
    }


    function formatoCNPJ(cnpj) {
      var cnpjEntidad = cnpj.replace('.', '');
      cnpjEntidad = cnpjEntidad.replace('-', '');
      cnpjEntidad = cnpjEntidad.replace('.', '');
      cnpjEntidad = cnpjEntidad.replace('/', '');

      return cnpjEntidad;
    }

    function obtenerDetalleRegistroObligatorio(invoice_id, contador) {

      var string = "";
      var identifMulta = 0;

      if (MORA_DIA) {
        MORA_DIA = formatoMonto(MORA_DIA);
      }

      if (MULTA) {
        identifMulta = 2;
        MULTA = parseFloat(MULTA).toFixed(0);
        MULTA = formatoMonto(MULTA);
      }

      string += '1'; //tipoRegistro
      string += '02' //tipoInscripcionEmpresa CNPJ (subsidiaria)
      cnpjSubsidiaria = formatoCNPJ(cnpjSubsidiaria);
      string += completarInicio(cnpjSubsidiaria, 14, '0'); // cnpjEmpresa
      string += completarFinal(cuentaCobro, 12, ' '); // codigoEmpresa o tmb llamdo cuenta de Cobranza
      string += completarInicio(complementoRegistro, 8, ' '); // Complemento de Registro A(8)
      string += completarFinal(COD_EMPRESA, 25, ' '); // usoEmpresa
      string += completarInicio(nossoNumero, 12, ' '); // nossoNumero (BAML Direct Collection - Rpta BOA)
      string += completarInicio(complementoRegistro, 8, ' '); // Complemento de Registro A(8)
      string += '000'; // BancoCobranzaDirecta (No utliza LogMein cobranzaDirecta)
      string += completarInicio(complementoRegistro, 21, ' '); // Complemento de Registro A(21)
      string += completarInicio(codigoCartera, 2, '0') // Codigo Cartera
      var codigoOcurrenciaRemesa = '';
      var fecha_procesamiento = '';

      //Busqueda del record customrecord_lmry_br_transaction_fields para el campo status y fecha de procesamiento
      var searchBRTransactionFields = search.create({
        type: 'customrecord_lmry_br_transaction_fields',
        columns: ['custrecord_lmry_br_related_transaction', 'custrecord_lmry_br_bb_status.custrecord_lmry_br_bb_code', 'custrecord_lmry_br_processing_date'],
        filters: ['custrecord_lmry_br_related_transaction', 'is', invoice_id]
      });
      searchResult = searchBRTransactionFields.run().getRange(0, 1);
      if (searchResult != '' && searchResult != null) {
        var col = searchResult[0].columns;
        var id_estado_boletoBancario = searchResult[0].getValue(col[1]);

        fecha_procesamiento = searchResult[0].getValue({
          name: 'custrecord_lmry_br_processing_date'
        });
      }

      if (id_estado_boletoBancario)
        codigoOcurrenciaRemesa = id_estado_boletoBancario;

      if (fecha_procesamiento) {
        fecha_procesamiento = formatoFecha(fecha_procesamiento);
      } else {
        fecha_procesamiento = formatoFecha(new Date());
      }

      string += completarInicio(codigoOcurrenciaRemesa, 2, '0'); //Codigo de Ocurrencia de Remesa
      string += completarFinal(numPreImpreso, 10, ' '); //suNumero
      string += completarFinal(dueDateInvoice, 6, '0'); // Fecha de vencimiento  (invoice y/o Boleto Bancario)
      string += completarInicio(montoTotalInvoice, 13, '0'); //valorTítulo
      string += completarInicio(complementoRegistro, 8, ' '); //Complemento de Registro A(8)
      string += '01'; //especieTitulo (siempre sera 01 porque es DM)
      string += 'N'; //aceite (siempre sera N- no)
      string += completarFinal(fecha_procesamiento, 6, '0'); //fechaProcesamiento
      string += '00'; //instruccion_1
      string += '00'; //instruccion_2
      string += completarInicio(MORA_DIA, 13, '0'); //intereses diario(siempre sera 0)
      string += completarInicio(complementoRegistro, 6, '0'); //fechaDescuento
      string += completarInicio(complementoRegistro, 13, '0'); //valorDescuento
      string += completarInicio(complementoRegistro, 13, ' '); //Complemento de Registro A(13)
      string += completarInicio(complementoRegistro, 13, '0'); //No habra Reembolso
      string += tipoCustomer; //tipoPagador
      string += completarInicio(cnpjCustomer, 14, '0'); //cnpjPagador
      string += completarFinal(nomCustomer, 40, ' '); //nombrePagador
      string += completarInicio(complementoRegistro, 10, ' '); //Complemento de Registro A(10)
      string += completarFinal(addressCustomer, 40, ' '); //direccionPagador
      string += completarFinal(bairroCustomer, 12, ' '); //Bairro Pagador
      string += completarFinal(cepCustomer, 8, '0'); //cepPagador
      string += completarFinal(ciudadCustomer, 15, ' '); //ciudadPagador
      string += completarFinal(ufCustomer, 2, ' '); //ufPagador
      var inst = numPreImpreso + ' ' + memo;
      string += completarInicio(inst, 30, ' '); //Mensaje
      string += completarFinal(identifMulta, 1, ' '); //indicadorMulta (No esta contemplado penalizacion)
      string += completarInicio(MULTA, 2, ' ');; //procentajeMulta (como no hay penalizacion, es completado con 2 espacios en blanco)
      string += ' '; //Complemento de Registro A(1)
      string += '000000'; //fechaIntereses
      string += '00'; //plazoNotarial - No esta contemplado, por ello 00
      string += ' '; //Complemento de Registro A(1)
      string += completarInicio(contador, 6, '0'); //secuencia
      string += completarInicio(complementoRegistro, 2, '0'); //tipoEmitente
      string += completarInicio(complementoRegistro, 14, ' '); //cnpjEmitente
      string += completarInicio(complementoRegistro, 40, ' '); //nombreEmitente
      string += completarInicio(complementoRegistro, 40, ' '); //direccionEmitente
      string += completarInicio(complementoRegistro, 15, ' '); //ciudadEmitente
      string += completarInicio(complementoRegistro, 2, ' '); //ufEmitente
      string += completarInicio(complementoRegistro, 8, ' '); //cepEmitente
      string += completarFinal(emailCustomer, 120, ' '); //emailPagador
      string += '000000'; //fechaDescuento_2
      string += completarInicio(complementoRegistro, 13, '0'); //valorDescuento_2
      string += '000000'; //fechaDescuento_3
      string += completarInicio(complementoRegistro, 13, '0'); //valorDescuento_3
      string += ' '; //indicativoTipoAutorizacion
      string += ' '; //indicativoValorPorcentaje
      string += completarInicio(complementoRegistro, 13, ' '); //cantidadMinimaPago
      string += completarInicio(complementoRegistro, 13, ' '); //cantidadMaximaPago
      string += ' '; //Complemento de Registro A(1)
      string += '  '; //cant. de pagos parciales (Pero no habra pagos parciales)


      return string;
    }

    function obtenerDetalleRegistroOpcional(contador) {

      var string = '';

      string += '2'; // tipo de Registro
      string += completarInicio(complementoRegistro, 80, ' '); //Mensaje 1
      string += completarInicio(complementoRegistro, 80, ' '); //Mensaje 2
      string += completarInicio(complementoRegistro, 80, ' '); //Mensaje 3
      string += completarInicio(complementoRegistro, 80, ' '); //Mensaje 4
      string += completarInicio(complementoRegistro, 44, ' '); //Complemento de Registro A(44)
      string += completarFinal(numPreImpreso, 10, ' '); //suNumero
      string += completarFinal(dueDateInvoice, 6, '0'); // Fecha de vencimiento  (invoice y/o Boleto Bancario)
      string += completarInicio(montoTotalInvoice, 13, '0'); //valorTítulo
      string += completarInicio(contador, 6, '0'); //secuencia

      return string;
    }

    function obtenerTrailerArchivo(contador) {

      var string = '';
      string += '9'; //tipoRegistro
      string += completarInicio(complementoRegistro, 393, ' '); //Complemento de Registro A(393)
      string += completarInicio(contador, 6, '0'); //secuencia

      return string;

    }

    function completarInicio(dato, cantMaxima, caracter) {
      var dato = dato.toString();
      while (dato.length < cantMaxima) {
        dato = caracter + dato
      }
      if (dato.lentgh == cantMaxima) {
        log.error('[campo]', dato + ' - ' + dato.length);
        return dato;
      } else {
        dato = dato.substring(0, cantMaxima);
        log.error('[campo]', dato + ' - ' + dato.length);
        return dato;
      }
    }

    function completarFinal(dato, cantMaxima, caracter) {
      var dato = dato.toString();
      while (dato.length < cantMaxima) {
        dato = dato + caracter
      }
      if (dato.lentgh == cantMaxima) {
        log.error('[campo]', dato + ' - ' + dato.length);
        return dato;
      } else {
        dato = dato.substring(0, cantMaxima);
        log.error('[campo]', dato + ' - ' + dato.length);
        return dato;
      }
    }

    // Datos del Customer
    function obtenerDatosCustomer(id_customer, internalId) {
      if (id_customer != 0) {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var customer_columns = ['isperson', 'firstname', 'lastname', 'companyname', 'email'];

        /**
         * Para SuiteTax
         */
        if (ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: internalId,
            isDynamic: true
          });
          var customer_cnpj = transObj.getText({ fieldId: 'entitytaxregnum' });
        } else {
          customer_columns.push("vatregnumber");
        }

        var recordCustomer = search.lookupFields({
          type: search.Type.CUSTOMER,
          id: id_customer,
          columns: customer_columns
        });

        var nom_customer = '';
        var typeCustomer = recordCustomer.isperson

        //Si el Customer es persona natural typeCustomer es true
        if (typeCustomer == 'T') {
          var firtsName = recordCustomer.firstname
          var lastName = recordCustomer.lastname;

          nom_customer = firtsName + ' ' + lastName;
          tipoCustomer = '01';

        } else {
          nom_customer = recordCustomer.companyname;
          tipoCustomer = '02';
        }

        // NOMBRE DEL CLIENTE
        if (nom_customer) {
          nomCustomer = nom_customer;
        }

        //CNPJ del Customer
        var cnpjCustomer = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpjCustomer = recordCustomer.vatregnumber;
        } else {
          cnpjCustomer = customer_cnpj;
        }

        if (cnpjCustomer)
          cnpjCustomer = formatoCNPJ(cnpjCustomer);


        //Email del Customer
        emailCustomer = recordCustomer.email;

        // Direccion del Cliente
        var billAdress1 = '';
        // Numero de la direccion
        var billAdress2 = '';
        // Complemento - creo q es el estado
        var billAdress3 = '';
        // Barrio
        var billAdress4 = '';
        // Ciudad
        var billAdress5 = '';
        // Provincia
        var billAdress6 = '';
        // Zip - es el CEP del customer
        var billAdress7 = '';
        // Country
        var billAdress8 = '';

        // Campos de la direccion
        var col_billadd = ['billingAddress.address1', 'billingAddress.custrecord_lmry_address_number',
          'billingAddress.custrecord_lmry_addr_reference', 'billingAddress.address2',
          'billingAddress.custrecord_lmry_addr_city', 'billingAddress.custrecord_lmry_addr_prov_acronym',
          'billingAddress.zip', 'billingAddress.country'
        ]

        // Busqueda en el record de direcciones
        var busqAddressRece = search.create({
          type: 'transaction',
          columns: col_billadd,
          filters: [
            ["internalid", "anyof", internalId],
            "AND", ["mainline", "is", "T"]
          ]
        });

        var resultAddress = busqAddressRece.run().getRange(0, 10);

        if (resultAddress != null && resultAddress.length != 0) {
          row = resultAddress[0].columns;
          billAdress1 = resultAddress[0].getValue(row[0]);
          if (billAdress1 == '' || billAdress1 == null) {
            billAdress1 = '';
          }
          // Numero de la direccion
          billAdress2 = resultAddress[0].getValue(row[1]);
          if (billAdress1 == '' || billAdress1 == null) {
            billAdress1 = '';
          }
          // Complemento
          billAdress3 = resultAddress[0].getValue(row[2]);
          if (billAdress3 == '' || billAdress3 == null) {
            billAdress3 = '';
          }

          // Barrio
          billAdress4 = resultAddress[0].getValue(row[3]);
          if (billAdress4 == '' || billAdress4 == null) {
            billAdress4 = '';
          }
          bairroCustomer = billAdress4;
          // Ciudad
          billAdress5 = resultAddress[0].getText(row[4]);
          if (billAdress5 == '' || billAdress5 == null) {
            billAdress5 = '';
          }
          ciudadCustomer = billAdress5;

          // Provincia acronimo
          billAdress6 = resultAddress[0].getValue(row[5]);
          if (billAdress6 == '' || billAdress6 == null) {
            billAdress6 = '';
          }
          ufCustomer = billAdress6;

          // Zip
          billAdress7 = resultAddress[0].getValue(row[6]);
          if (billAdress7 == '' || billAdress7 == null) {
            billAdress7 = '';
          }
          billAdress7 = billAdress7.replace(/[^0-9]/g, '');
          cepCustomer = billAdress7;


          // Country
          billAdress8 = resultAddress[0].getValue(row[7]);
          if (billAdress8 == '' || billAdress8 == null) {
            billAdress8 = '';
          }
        }

        // Arma la direccion completa
        addressCustomer = billAdress1 + ' ' + billAdress2 + ' ' +
          billAdress3 + ' ' + billAdress4 + ' ' +
          billAdress5 + ' ' + billAdress6 + ' ' +
          billAdress7 + ' ' + billAdress8


      }
      return true;

    }

    function formatoFecha(fecha) {

      var formatoFecha = '';

      fecha = format.parse({
        value: fecha,
        type: format.Type.DATE
      });

      var day = fecha.getDate();
      day = day.toString();
      if (day.length == 1) {
        day = '0' + day
      }

      var month = fecha.getMonth() + 1;
      month = month.toString();
      if (month.length == 1) {
        month = '0' + month
      }

      var year = fecha.getFullYear();
      year = year.toString();
      formatoFechaNameFile = year + month + day;
      //log.debug('formatoFechaNameFile', formatoFechaNameFile);

      year = year.substring(2, 4);


      formatoFecha = day + month + year;
      return formatoFecha;
    }

    function formatoMonto(monto) {
      var monto_invoice = '';
      monto_invoice = monto.replace(',', '');
      monto_invoice = monto_invoice.replace('.', '');

      return monto_invoice;
    }

    // Datos de la Factura
    function obtenerDetalleRegistroObli(id_invoice, secuencia) {
      var recordInvoice = search.lookupFields({
        type: search.Type.INVOICE,
        id: id_invoice,
        columns: ['subsidiary', 'entity', 'tranid', 'memo', 'trandate', 'duedate', 'total', 'fxamount', 'custbody_lmry_wtax_code_des', 'custbody_lmry_wtax_amount']
      });
      //log.debug('recordInvoice', recordInvoice);
      var customer = recordInvoice.entity[0].value;
      var subsidiary = recordInvoice.subsidiary[0].value;

      numPreImpreso = recordInvoice.tranid;
      memo = recordInvoice.memo;
      // 10 caracteres desde la izquierda
      numPreImpreso = numPreImpreso.substring(numPreImpreso.length - 10, numPreImpreso.length);
      numPreImpreso = numPreImpreso.trim();

      dateInvoice = recordInvoice.trandate;
      dateInvoice = formatoFecha(dateInvoice);

      dueDateInvoice = recordInvoice.duedate;
      if (dueDateInvoice) {
        dueDateInvoice = formatoFecha(dueDateInvoice);
      }
      montoTotalInvoice = '' + recordInvoice.fxamount;

      licenses = libraryMail.getLicenses(subsidiary);

      /******************************************************************+******************************************
      - Descripción: Si esta activo el Feature  BR - LATAM WHT TAX y el campo tax_code_des tiene la descripción
        Latam - WHT Tax , Se resta el monto del invoice con el monto de la retencion (ID:custbody_lmry_wtax_amount)
      ***************************************************************************************************************/
      var tax_code_des = recordInvoice.custbody_lmry_wtax_code_des;

      if (libraryMail.getAuthorization(416, licenses) == true && tax_code_des == 'Latam - WHT Tax') {
        FLAG = true;
        var retencion = recordInvoice.custbody_lmry_wtax_amount;
        montoTotalInvoice = montoTotalInvoice - retencion;
        montoTotalInvoice = montoTotalInvoice.toFixed(2);
      }
      // ****************************************************************************************************************

      montoTotalInvoice = formatoMonto(montoTotalInvoice);

      obtenerDatosCustomer(customer, id_invoice);
      calcularInstallments(id_invoice);

      registroObligatorio = '\n' + obtenerDetalleRegistroObligatorio(id_invoice, secuencia);

      return registroObligatorio;
    }

    function calcularInstallments(id_invoice) {
      try {
        if (ID_INST != '' && ID_INST != null) {
          //Nosso Número
          nossoNumero = formandoNossoNumero(id_invoice, ID_INST);

          COD_EMPRESA = id_invoice + '_' + ID_INST;
          if (DUEDATE_INST) {
            dueDateInvoice = formatoFecha(DUEDATE_INST);
          }
          montoTotalInvoice = AMOUNT_INST;

          //Cálculo de retención para installments
          var jsonInstallments = [];
          if (RETENCION_INST != '' && RETENCION_INST != null) {
            jsonInstallments = JSON.parse(RETENCION_INST);
          }

          if (Object.keys(jsonInstallments).length) {
            for (var idInstallment in jsonInstallments) {
              if (ID_INST == idInstallment) {
                if (jsonInstallments[idInstallment]['wht'] && FLAG) {
                  var retencion = Math.round(parseFloat(jsonInstallments[idInstallment]['wht']) * 100) / 100;
                  retencion = retencion.toFixed(2);
                  montoTotalInvoice = Math.round((parseFloat(montoTotalInvoice) - parseFloat(retencion)) * 100) / 100;
                }
              }
            }
          }

          montoTotalInvoice = Number(montoTotalInvoice).toFixed(2);
          montoTotalInvoice = formatoMonto(montoTotalInvoice);

        } else {
          nossoNumero = formandoNossoNumero(id_invoice);
          COD_EMPRESA = id_invoice;
        }

      } catch (error) {
        log.error('ERROR', '[ calcularInstallments ]');
        libraryMail.sendemail(' [ calcularInstallments ] ' + error, LMRY_script);
      }
    }

    function search_folder() {
      try {
        // Ruta de la carpeta contenedora
        var FolderId = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_arquivo_remessa'
        });


        if (FolderId == '' || FolderId == null) {
          // Valida si existe "SuiteLatamReady" en File Cabinet
          var varIdFolderPrimary = '';

          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: ['name', 'is', 'SuiteLatamReady']
          });

          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'SuiteLatamReady');
            varIdFolderPrimary = varRecordFolder.save();
          } else {
            varIdFolderPrimary = objResult[0].getValue('internalid');
          }

          // Valida si existe "Latam BR - Arquivo Remessa" en File Cabinet
          var varFolderId = '';
          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: [
              ['name', 'is', 'Latam BR - Arquivo Remessa']
            ]
          });
          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'Latam BR - Arquivo Remessa');
            varRecordFolder.setValue('parent', varIdFolderPrimary);
            varFolderId = varRecordFolder.save();
          } else {
            varFolderId = objResult[0].getValue('internalid');
          }


          // Load the NetSuite Company Preferences page
          var varCompanyReference = config.load({
            type: config.Type.COMPANY_PREFERENCES
          });

          // set field values
          varCompanyReference.setValue({
            fieldId: 'custscript_lmry_br_arquivo_remessa',
            value: varFolderId
          });
          // save changes to the Company Preferences page
          varCompanyReference.save();
        }



      } catch (err) {
        libraryMail.sendemail(' [ search_folder ] ' + err, LMRY_script);
        // Mail de configuracion del folder
        //LIBRARY.sendMail(LMRY_script, ' [ onRequest ] ' + err);

      }
    }

    function getPedidoBaixa(invoiceID) {
      var pedidobaixa = false;
      var searchBRTransactionFields = search.create({
        type: 'customrecord_lmry_br_transaction_fields',
        columns: ['custrecord_lmry_br_bb_status'],
        filters: [
          ['isinactive', 'is', 'F'], 'AND',
          ['custrecord_lmry_br_related_transaction', 'is', invoiceID]
        ]
      });
      var searchResult = searchBRTransactionFields.run().getRange(0, 1);
      if (searchResult != null && searchResult != '') {
        if (searchResult[0].getValue('custrecord_lmry_br_bb_status') == 2) {
          pedidobaixa = true;
        }
      }
      return pedidobaixa;
    }

    // Link each entry point to the appropriate function.

    return {
      getInputData: getInputData,
      map: map,
      //reduce: reduce,
      summarize: summarize
    };
  });
